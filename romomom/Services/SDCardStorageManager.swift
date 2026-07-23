import Foundation
import SwiftData

public enum SDCardError: Error, LocalizedError {
    case bookmarkFailed
    case accessDenied
    case fileAlreadyExists
    case sourceFileNotFound
    case transferFailed(String)

    public var errorDescription: String? {
        switch self {
        case .bookmarkFailed: return "Failed to create or resolve security-scoped bookmark."
        case .accessDenied: return "Access to the external storage was denied."
        case .fileAlreadyExists: return "The file already exists on the SD card."
        case .sourceFileNotFound: return "The source file could not be found."
        case .transferFailed(let message): return "Transfer failed: \(message)"
        }
    }
}

@Observable
public class SDCardStorageManager {
    public var rootURL: URL?

    private let bookmarkKey = "SDCardBookmarkData"

    public init() {
        loadBookmark()
    }

    private func loadBookmark() {
        guard let bookmarkData = UserDefaults.standard.data(forKey: bookmarkKey) else { return }

        var isStale = false
        do {
            let url = try URL(resolvingBookmarkData: bookmarkData, options: .withSecurityScope, relativeTo: nil, bookmarkDataIsStale: &isStale)
            if isStale {
                try saveBookmark(for: url)
            }
            self.rootURL = url
        } catch {
            print("Failed to resolve bookmark: \(error)")
        }
    }

    private func saveBookmark(for url: URL) throws {
        guard url.startAccessingSecurityScopedResource() else {
            throw SDCardError.accessDenied
        }
        defer { url.stopAccessingSecurityScopedResource() }

        do {
            let bookmarkData = try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(bookmarkData, forKey: bookmarkKey)
        } catch {
            throw SDCardError.bookmarkFailed
        }
    }

    public func selectSDCardRootFolder(url: URL) throws {
        try saveBookmark(for: url)
        self.rootURL = url
    }

    public func getDestinationFolder(for console: String) throws -> URL {
        guard let rootURL = rootURL else {
            throw SDCardError.accessDenied
        }

        guard rootURL.startAccessingSecurityScopedResource() else {
            throw SDCardError.accessDenied
        }
        defer { rootURL.stopAccessingSecurityScopedResource() }

        let romsFolder = rootURL.appendingPathComponent("roms")
        let consoleFolder = romsFolder.appendingPathComponent(console.lowercased())

        if !FileManager.default.fileExists(atPath: consoleFolder.path) {
            do {
                try FileManager.default.createDirectory(at: consoleFolder, withIntermediateDirectories: true, attributes: nil)
            } catch {
                throw SDCardError.transferFailed("Could not create destination directory: \(error.localizedDescription)")
            }
        }

        return consoleFolder
    }

    public func pushVariantToSDCard(variant: GameItem, destinationConsoleFolder: String) async throws -> URL {
        guard let rootURL = rootURL else {
            throw SDCardError.accessDenied
        }

        guard rootURL.startAccessingSecurityScopedResource() else {
            throw SDCardError.accessDenied
        }
        defer { rootURL.stopAccessingSecurityScopedResource() }

        let sourceURL = URL(fileURLWithPath: variant.localFilePath)

        guard FileManager.default.fileExists(atPath: sourceURL.path) else {
            throw SDCardError.sourceFileNotFound
        }

        let destinationFolder = try getDestinationFolder(for: destinationConsoleFolder)
        let filename = sourceURL.lastPathComponent
        let finalDestinationURL = destinationFolder.appendingPathComponent(filename)

        if FileManager.default.fileExists(atPath: finalDestinationURL.path) {
            throw SDCardError.fileAlreadyExists
        }

        let tempFileName = filename + ".tmp"
        let tempDestinationURL = destinationFolder.appendingPathComponent(tempFileName)

        // Remove existing temp file if there's an orphaned one
        if FileManager.default.fileExists(atPath: tempDestinationURL.path) {
            try? FileManager.default.removeItem(at: tempDestinationURL)
        }

        do {
            try FileManager.default.copyItem(at: sourceURL, to: tempDestinationURL)
        } catch {
            throw SDCardError.transferFailed("Failed to copy file to temporary location: \(error.localizedDescription)")
        }

        do {
            // Atomic move/rename
            try FileManager.default.moveItem(at: tempDestinationURL, to: finalDestinationURL)
        } catch {
            // Try to clean up temp file if move failed
            try? FileManager.default.removeItem(at: tempDestinationURL)
            throw SDCardError.transferFailed("Failed to rename temporary file to final destination: \(error.localizedDescription)")
        }

        return finalDestinationURL
    }

    public func getExistingSDCardFiles(for console: String) throws -> [URL] {
        guard let rootURL = rootURL else {
            throw SDCardError.accessDenied
        }

        guard rootURL.startAccessingSecurityScopedResource() else {
            throw SDCardError.accessDenied
        }
        defer { rootURL.stopAccessingSecurityScopedResource() }

        let destinationFolder = try getDestinationFolder(for: console)

        do {
            let contents = try FileManager.default.contentsOfDirectory(at: destinationFolder, includingPropertiesForKeys: nil, options: .skipsHiddenFiles)
            return contents
        } catch {
            // If the folder doesn't exist or can't be read, we can just return empty array or throw.
            // But since getDestinationFolder creates it, if it fails here, something is wrong.
            throw SDCardError.transferFailed("Failed to read contents of destination folder: \(error.localizedDescription)")
        }
    }
}
