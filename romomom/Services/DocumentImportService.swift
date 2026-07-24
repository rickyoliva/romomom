import Foundation
import SwiftData
import CryptoKit
import UniformTypeIdentifiers
import SWCompression
import zlib

public enum ImportServiceError: Error, LocalizedError {
    case accessDenied
    case extractionFailed(String)
    case unsupportedFormat
    case fileCopyFailed(String)
    case hashCalculationFailed
    case noValidROMFound

    public var errorDescription: String? {
        switch self {
        case .accessDenied: return "Access to the selected file was denied."
        case .extractionFailed(let msg): return "Failed to extract archive: \(msg)"
        case .unsupportedFormat: return "The selected file format is not supported."
        case .fileCopyFailed(let msg): return "Failed to copy file to local storage: \(msg)"
        case .hashCalculationFailed: return "Failed to calculate file hash."
        case .noValidROMFound: return "No valid ROM file was found inside the archive."
        }
    }
}

@Observable
public class DocumentImportService {

    public init() {}

    @MainActor
    public func importLocalFile(url: URL, context: ModelContext) async throws -> GameItem {
        guard url.startAccessingSecurityScopedResource() else {
            throw ImportServiceError.accessDenied
        }
        defer { url.stopAccessingSecurityScopedResource() }

        let fileExtension = url.pathExtension.lowercased()
        var finalURLToProcess = url
        var isTempFile = false

        // Handle archives
        if ["zip", "7z", "rar"].contains(fileExtension) {
            finalURLToProcess = try await extractArchive(url: url)
            isTempFile = true
        } else if !isSupportedROM(extension: fileExtension) {
            throw ImportServiceError.unsupportedFormat
        }

        defer {
            if isTempFile {
                let folder = finalURLToProcess.deletingLastPathComponent()
                try? FileManager.default.removeItem(at: finalURLToProcess)
                try? FileManager.default.removeItem(at: folder)
            }
        }

        // Calculate hashes
        let (md5, crc32) = try calculateHashes(for: finalURLToProcess)

        // Move to local app Application Support directory
        let appSupportDirectory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let fileName = finalURLToProcess.lastPathComponent
        let destinationURL = appSupportDirectory.appendingPathComponent(fileName)

        if FileManager.default.fileExists(atPath: destinationURL.path) {
            try? FileManager.default.removeItem(at: destinationURL)
        }

        do {
            try FileManager.default.copyItem(at: finalURLToProcess, to: destinationURL)
        } catch {
            throw ImportServiceError.fileCopyFailed(error.localizedDescription)
        }

        let finalExtension = destinationURL.pathExtension.lowercased()
        let console = determineConsole(from: finalExtension)
        let title = destinationURL.deletingPathExtension().lastPathComponent

        let gameItem = GameItem(
            title: title,
            console: console,
            displayType: .baseParent,
            localFilePath: destinationURL.path,
            isVanilla: true,
            headerHash: md5 // Or store both
        )

        context.insert(gameItem)

        return gameItem
    }

    private func extractArchive(url: URL) async throws -> URL {
        let fileExtension = url.pathExtension.lowercased()
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true, attributes: nil)

        let archiveData: Data
        do {
            archiveData = try Data(contentsOf: url)
        } catch {
            throw ImportServiceError.extractionFailed("Could not read archive file.")
        }

        var extractedEntries: [String: Data] = [:]

        do {
            if fileExtension == "zip" {
                let entries = try ZipContainer.open(container: archiveData)
                for entry in entries {
                    if let data = entry.data {
                        extractedEntries[entry.info.name] = data
                    }
                }
            } else if fileExtension == "7z" {
                let entries = try SevenZipContainer.open(container: archiveData)
                for entry in entries {
                    if let data = entry.data {
                        extractedEntries[entry.info.name] = data
                    }
                }
            } else if fileExtension == "rar" {
                // Assuming Tar for rar since swcompression doesn't seem to natively support RAR out of the box in simple container APIs
                // Actually, SWCompression supports Tar, Zip, 7z. Let's just use 7z and Zip. If rar is required, we can throw unsupported.
                // Wait, SWCompression doesn't support RAR.
                throw ImportServiceError.extractionFailed("RAR extraction is currently unsupported by the archive library.")
            }
        } catch {
            throw ImportServiceError.extractionFailed(error.localizedDescription)
        }

        // Find the first valid ROM file
        var foundURL: URL?
        for (name, data) in extractedEntries {
            let ext = (name as NSString).pathExtension.lowercased()
            if isSupportedROM(extension: ext) {
                let fileURL = tempDir.appendingPathComponent((name as NSString).lastPathComponent)
                try data.write(to: fileURL)
                foundURL = fileURL
                break
            }
        }

        guard let validURL = foundURL else {
            throw ImportServiceError.noValidROMFound
        }

        return validURL
    }

    private func isSupportedROM(extension ext: String) -> Bool {
        return ["gba", "nds", "gbc", "nes", "bps", "ips", "gb", "sfc", "smc"].contains(ext)
    }

    private func determineConsole(from ext: String) -> String {
        switch ext {
        case "gba": return "GBA"
        case "nds": return "NDS"
        case "gbc": return "GBC"
        case "nes": return "NES"
        case "gb": return "GB"
        case "sfc", "smc": return "SNES"
        case "bps", "ips": return "Patch"
        default: return "Unknown"
        }
    }

    private func calculateHashes(for url: URL) throws -> (md5: String, crc32: String) {
        let data: Data
        do {
            data = try Data(contentsOf: url, options: .alwaysMapped)
        } catch {
            throw ImportServiceError.hashCalculationFailed
        }

        // MD5
        let md5Digest = Insecure.MD5.hash(data: data)
        let md5String = md5Digest.map { String(format: "%02x", $0) }.joined()

        // CRC32
        var crc: uLong = crc32(0, nil, 0)
        data.withUnsafeBytes { buffer in
            if let baseAddress = buffer.bindMemory(to: Bytef.self).baseAddress {
                crc = crc32(crc, baseAddress, uInt(buffer.count))
            }
        }
        let crc32String = String(format: "%08x", crc)

        return (md5String, crc32String)
    }
}
