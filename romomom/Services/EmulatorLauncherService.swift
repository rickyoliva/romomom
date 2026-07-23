import Foundation
import UIKit
import Observation

public enum SupportedEmulator: String, CaseIterable, Identifiable {
    case delta = "delta"
    case retroarch = "retroarch"
    case ignited = "ignited"
    case ppsspp = "ppsspp"
    case folium = "folium"

    public var id: String { self.rawValue }

    public var displayName: String {
        switch self {
        case .delta: return "Delta"
        case .retroarch: return "RetroArch"
        case .ignited: return "Ignited"
        case .ppsspp: return "PPSSPP"
        case .folium: return "Folium"
        }
    }

    public var urlScheme: String {
        return "\(self.rawValue)://"
    }
}

public enum EmulatorLauncherError: Error, LocalizedError {
    case fileNotFound
    case unableToPreparePayload(Error)
    case emulatorNotInstalled(SupportedEmulator)
    case unableToLaunch(Error?)
    case invalidURL

    public var errorDescription: String? {
        switch self {
        case .fileNotFound:
            return "The ROM file could not be found."
        case .unableToPreparePayload(let error):
            return "Failed to prepare the file for sharing: \(error.localizedDescription)"
        case .emulatorNotInstalled(let emulator):
            return "\(emulator.displayName) is not installed or the scheme is not registered."
        case .unableToLaunch(let error):
            if let error = error {
                return "Failed to launch the emulator: \(error.localizedDescription)"
            }
            return "Failed to launch the emulator."
        case .invalidURL:
            return "Could not construct a valid URL to launch the emulator."
        }
    }
}

@Observable
public final class EmulatorLauncherService {

    public init() {}

    /// Prepares a clean payload in the temporary directory suitable for external access.
    public func getShareSheetPayload(for variant: GameItem) throws -> URL {
        let fileManager = FileManager.default
        let sourceURL = URL(fileURLWithPath: variant.localFilePath)

        guard fileManager.fileExists(atPath: sourceURL.path) else {
            throw EmulatorLauncherError.fileNotFound
        }

        let tempDirectory = fileManager.temporaryDirectory

        // Extract the file extension
        let fileExtension = sourceURL.pathExtension

        // Sanitize the title to create a clean filename
        let sanitizedTitle = variant.title.replacingOccurrences(of: " ", with: "_")
                                          .replacingOccurrences(of: "/", with: "-")
                                          .replacingOccurrences(of: "\\", with: "-")

        let cleanFileName = "\(sanitizedTitle).\(fileExtension)"
        let destinationURL = tempDirectory.appendingPathComponent(cleanFileName)

        do {
            // Remove existing file if it exists to ensure a fresh copy
            if fileManager.fileExists(atPath: destinationURL.path) {
                try fileManager.removeItem(at: destinationURL)
            }

            // Copy the file to the temporary directory so it can be accessed by other apps/Share Sheet
            try fileManager.copyItem(at: sourceURL, to: destinationURL)
            return destinationURL
        } catch {
            throw EmulatorLauncherError.unableToPreparePayload(error)
        }
    }

    /// Checks if a specific emulator is installed by testing its URL scheme.
    @MainActor
    public func canOpenEmulator(_ emulator: SupportedEmulator) -> Bool {
        guard let url = URL(string: emulator.urlScheme) else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    /// Prepares the file and attempts to launch the specified emulator via deep-link.
    @MainActor
    public func launchGame(_ variant: GameItem, in emulator: SupportedEmulator) async throws {
        guard canOpenEmulator(emulator) else {
            throw EmulatorLauncherError.emulatorNotInstalled(emulator)
        }

        // Prepare the payload in the temporary directory
        let payloadURL = try getShareSheetPayload(for: variant)

        // Construct the deep-link URL.
        // We use a generic 'open?path=' format as requested. Individual emulators might have
        // specific requirements, but this serves as the standard template.
        var components = URLComponents(string: "\(emulator.urlScheme)open")
        components?.queryItems = [
            URLQueryItem(name: "path", value: payloadURL.path)
        ]

        guard let launchURL = components?.url else {
            throw EmulatorLauncherError.invalidURL
        }

        let success = await UIApplication.shared.open(launchURL, options: [:])

        if !success {
            // Fallback: If opening with the specific path fails, try opening just the app scheme.
            // A more robust fallback in the UI layer would be to catch this and present a Share Sheet.
            guard let fallbackURL = URL(string: emulator.urlScheme) else {
                throw EmulatorLauncherError.invalidURL
            }
            let fallbackSuccess = await UIApplication.shared.open(fallbackURL, options: [:])
            if !fallbackSuccess {
                 throw EmulatorLauncherError.unableToLaunch(nil)
            }
        }
    }
}
