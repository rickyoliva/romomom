import Foundation
import WebKit

@Observable
public class PatcherService: NSObject {

    public override init() {
        super.init()
    }

    // Validate patch type by extension or header signature
    public func validatePatchType(patchData: Data, filename: String) -> String? {
        let ext = (filename as NSString).pathExtension.lowercased()
        if ext == "ips" || ext == "bps" || ext == "xdelta" || ext == "vcdiff" {
            if ext == "vcdiff" { return "xdelta" }
            return ext
        }

        // Header signature validation
        if patchData.count >= 5 {
            let header5 = String(decoding: patchData.prefix(5), as: UTF8.self)
            if header5.hasPrefix("PATCH") { return "ips" }
            if header5.hasPrefix("BPS1") { return "bps" }
            if header5.hasPrefix("%XDZ") || header5.hasPrefix("%XDELTA") || header5.hasPrefix(String(decoding: [0x56, 0x43, 0x44, 0x49, 0x46, 0x46], as: UTF8.self)) { return "xdelta" }
        }

        return nil
    }

    // Apply patch and return memory Data
    public func applyPatch(baseRomData: Data, patchData: Data, patchType: String) async throws -> Data {
        // Base64 encoding massive strings off the main thread to prevent UI freezing
        let (base64BaseRom, base64Patch) = await Task.detached(priority: .userInitiated) {
            return (baseRomData.base64EncodedString(), patchData.base64EncodedString())
        }.value

        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.main.async {
                let context = PatchContext(base64BaseRom: base64BaseRom, base64Patch: base64Patch, patchType: patchType, continuation: continuation)
                context.execute()
            }
        }
    }

    // Helper method to apply patch and save to a temporary file
    public func applyPatchAndSave(baseRomURL: URL, patchURL: URL) async throws -> URL {
        // Read file contents off the main thread with alwaysMapped to reduce RAM overhead
        let (baseRomData, patchData) = try await Task.detached(priority: .userInitiated) {
            let baseRomData = try Data(contentsOf: baseRomURL, options: .alwaysMapped)
            let patchData = try Data(contentsOf: patchURL, options: .alwaysMapped)
            return (baseRomData, patchData)
        }.value

        guard let patchType = validatePatchType(patchData: patchData, filename: patchURL.lastPathComponent) else {
            throw NSError(domain: "PatcherService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unsupported patch format"])
        }

        let patchedData = try await applyPatch(baseRomData: baseRomData, patchData: patchData, patchType: patchType)

        let tempDir = FileManager.default.temporaryDirectory
        let newFileName = UUID().uuidString + ".patched"
        let destURL = tempDir.appendingPathComponent(newFileName)

        try await Task.detached(priority: .background) {
            try patchedData.write(to: destURL, options: .atomic)
        }.value

        return destURL
    }
}

class PatchContext: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let base64BaseRom: String
    let base64Patch: String
    let patchType: String
    var continuation: CheckedContinuation<Data, Error>?
    var webView: WKWebView?

    init(base64BaseRom: String, base64Patch: String, patchType: String, continuation: CheckedContinuation<Data, Error>) {
        self.base64BaseRom = base64BaseRom
        self.base64Patch = base64Patch
        self.patchType = patchType
        self.continuation = continuation
    }

    func execute() {
        let config = WKWebViewConfiguration()
        let contentController = WKUserContentController()
        contentController.add(self, name: "patchHandler")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        self.webView = webView

        guard let htmlURL = Bundle.main.url(forResource: "patcher", withExtension: "html") else {
            continuation?.resume(throwing: NSError(domain: "PatcherService", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not find patcher.html in bundle"]))
            self.continuation = nil
            return
        }

        webView.navigationDelegate = self
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())

        // Retain self by setting associated object to webview so it doesn't get deallocated
        objc_setAssociatedObject(webView, "patchContext", self, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let script = """
            applyPatch("\(base64BaseRom)", "\(base64Patch)", "\(patchType)");
        """
        webView.evaluateJavaScript(script) { [weak self] _, error in
            if let error = error {
                print("Error evaluating javascript: \(error)")
                self?.continuation?.resume(throwing: error)
                self?.cleanup()
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "patchHandler", let body = message.body as? [String: Any] else { return }

        if let status = body["status"] as? String, status == "success",
           let base64Data = body["data"] as? String {
            // Decoding massive base64 string on main thread? Bad idea.
            // Move it to a background thread.
            Task.detached(priority: .userInitiated) {
                if let data = Data(base64Encoded: base64Data) {
                    await MainActor.run {
                        self.continuation?.resume(returning: data)
                        self.cleanup()
                    }
                } else {
                    await MainActor.run {
                        self.continuation?.resume(throwing: NSError(domain: "PatcherService", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to decode patched data"]))
                        self.cleanup()
                    }
                }
            }
        } else {
            let errorMsg = body["message"] as? String ?? "Unknown patching error"
            continuation?.resume(throwing: NSError(domain: "PatcherService", code: 3, userInfo: [NSLocalizedDescriptionKey: errorMsg]))
            cleanup()
        }
    }

    func cleanup() {
        self.continuation = nil
        self.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "patchHandler")
        self.webView = nil
    }
}
