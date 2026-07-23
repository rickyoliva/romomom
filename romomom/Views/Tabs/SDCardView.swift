import SwiftUI
import UniformTypeIdentifiers

struct SDCardView: View {
    @Environment(SDCardStorageManager.self) private var sdCardManager
    @State private var showingFileImporter = false
    @State private var files: [URL] = []
    @State private var errorMessage: String?
    @State private var showingError = false

    var body: some View {
        NavigationStack {
            VStack {
                if sdCardManager.rootURL == nil {
                    ContentUnavailableView(
                        "No SD Card Mounted",
                        systemImage: "externaldrive.fill.badge.xmark",
                        description: Text("Please select a folder on your external SD card to continue.")
                    )
                    Button("Mount SD Card") {
                        showingFileImporter = true
                    }
                    .buttonStyle(.borderedProminent)
                    .padding()
                } else {
                    List {
                        Section(header: Text("Mounted Location")) {
                            Text(sdCardManager.rootURL?.path ?? "Unknown")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Button("Change Mount Point") {
                                showingFileImporter = true
                            }

                            Button("Refresh") {
                                loadFiles()
                            }
                        }

                        Section(header: Text("GBA ROMs")) {
                            ForEach(files.filter { $0.pathExtension.lowercased() == "gba" }, id: \.self) { file in
                                Text(file.lastPathComponent)
                            }
                        }

                        Section(header: Text("NDS ROMs")) {
                            ForEach(files.filter { $0.pathExtension.lowercased() == "nds" }, id: \.self) { file in
                                Text(file.lastPathComponent)
                            }
                        }
                    }
                    .onAppear {
                        loadFiles()
                    }
                }
            }
            .navigationTitle("SD Card Manager")
            .fileImporter(isPresented: $showingFileImporter, allowedContentTypes: [.folder], allowsMultipleSelection: false) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    do {
                        try sdCardManager.selectSDCardRootFolder(url: url)
                        loadFiles()
                    } catch {
                        errorMessage = error.localizedDescription
                        showingError = true
                    }
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    showingError = true
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "Unknown Error")
            }
        }
    }

    private func loadFiles() {
        do {
            // Very simple listing of a few consoles to demonstrate functionality
            var allFiles: [URL] = []
            if let gba = try? sdCardManager.getExistingSDCardFiles(for: "gba") {
                allFiles.append(contentsOf: gba)
            }
            if let nds = try? sdCardManager.getExistingSDCardFiles(for: "nds") {
                allFiles.append(contentsOf: nds)
            }
            files = allFiles
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}
