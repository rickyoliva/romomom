import SwiftUI
import UniformTypeIdentifiers
import SwiftData

struct PatcherView: View {
    @Environment(PatcherService.self) private var patcherService
    @Environment(DocumentImportService.self) private var documentImportService
    @Environment(\.modelContext) private var modelContext

    @State private var baseRomURL: URL?
    @State private var patchFileURL: URL?
    @State private var patchedTitle: String = ""

    @State private var isSelectingBaseRom = false
    @State private var isSelectingPatchFile = false
    @State private var isImportingFile = false
    @State private var isPatching = false

    @State private var errorMessage: String?
    @State private var showingError = false
    @State private var showingSuccess = false

    // Parent game selection for associating the new variant
    @Query(filter: #Predicate<GameItem> { $0.parentGame == nil }) private var baseGames: [GameItem]
    @State private var selectedParentGame: GameItem?

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Files")) {
                    HStack {
                        Text("Base ROM")
                        Spacer()
                        Button(baseRomURL?.lastPathComponent ?? "Select File") {
                            isSelectingBaseRom = true
                        }
                    }

                    HStack {
                        Text("Patch File")
                        Spacer()
                        Button(patchFileURL?.lastPathComponent ?? "Select File") {
                            isSelectingPatchFile = true
                        }
                    }
                }

                Section(header: Text("Details")) {
                    TextField("Patched Game Title", text: $patchedTitle)

                    Picker("Associate with Base Game (Optional)", selection: $selectedParentGame) {
                        Text("None").tag(GameItem?.none)
                        ForEach(baseGames) { game in
                            Text(game.title).tag(GameItem?.some(game))
                        }
                    }
                }

                Section {
                    Button(action: applyPatch) {
                        if isPatching {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                        } else {
                            Text("Apply Patch")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .disabled(baseRomURL == nil || patchFileURL == nil || patchedTitle.isEmpty || isPatching)
                }
            }
            .navigationTitle("Patcher")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        isImportingFile = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .fileImporter(isPresented: $isImportingFile, allowedContentTypes: [.archive, .data], allowsMultipleSelection: false) { result in
                handleFileImport(result)
            }
            .fileImporter(isPresented: $isSelectingBaseRom, allowedContentTypes: [.data], allowsMultipleSelection: false) { result in
                handleFileSelection(result, isBaseRom: true)
            }
            .fileImporter(isPresented: $isSelectingPatchFile, allowedContentTypes: [.data], allowsMultipleSelection: false) { result in
                handleFileSelection(result, isBaseRom: false)
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "An unknown error occurred.")
            }
            .alert("Success", isPresented: $showingSuccess) {
                Button("OK", role: .cancel) {
                    resetForm()
                }
            } message: {
                Text("Patch applied successfully and added to library.")
            }
        }
    }

    private func handleFileSelection(_ result: Result<[URL], Error>, isBaseRom: Bool) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            // Ensure security-scoped access if needed for user-selected files
            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = "Access denied to the selected file."
                showingError = true
                return
            }

            if isBaseRom {
                baseRomURL = url
            } else {
                patchFileURL = url
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func applyPatch() {
        guard let baseRomURL = baseRomURL, let patchFileURL = patchFileURL else { return }
        isPatching = true

        Task {
            do {
                let patchedURL = try await patcherService.applyPatchAndSave(baseRomURL: baseRomURL, patchURL: patchFileURL)

                // Save to local app directory
                let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
                let finalURL = documentsDirectory.appendingPathComponent(patchedURL.lastPathComponent)
                try FileManager.default.moveItem(at: patchedURL, to: finalURL)

                let newGame = GameItem(
                    title: patchedTitle,
                    console: selectedParentGame?.console ?? "Unknown", // Simplification
                    displayType: .standaloneHack,
                    localFilePath: finalURL.path,
                    isVanilla: false,
                    parentGame: selectedParentGame
                )

                modelContext.insert(newGame)

                // Cleanup access
                self.baseRomURL?.stopAccessingSecurityScopedResource()
                self.patchFileURL?.stopAccessingSecurityScopedResource()

                showingSuccess = true
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
            isPatching = false
        }
    }

    private func resetForm() {
        baseRomURL = nil
        patchFileURL = nil
        patchedTitle = ""
        selectedParentGame = nil
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            Task {
                do {
                    _ = try await documentImportService.importLocalFile(url: url, context: modelContext)
                } catch {
                    errorMessage = error.localizedDescription
                    showingError = true
                }
            }
        case .failure(let error):
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}
