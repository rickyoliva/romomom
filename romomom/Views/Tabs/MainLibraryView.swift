import SwiftUI
import SwiftData

struct MainLibraryView: View {
    @Query(filter: #Predicate<GameItem> { $0.parentGame == nil }, sort: \.title)
    private var games: [GameItem]

    @Environment(\.modelContext) private var modelContext
    @Environment(EmulatorLauncherService.self) private var emulatorService

    @State private var selectedParentGame: GameItem?

    @State private var showingEmulatorPicker = false
    @State private var showingShareSheet = false
    @State private var selectedHack: GameItem?
    @State private var shareURL: URL?
    @State private var errorMessage: String?
    @State private var showingError = false

    let columns = [
        GridItem(.adaptive(minimum: 150), spacing: 16)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                if games.isEmpty {
                    ContentUnavailableView("No Games Found", systemImage: "gamecontroller.fill", description: Text("Add base games or patched ROMs to get started."))
                        .padding(.top, 40)
                } else {
                    LazyVGrid(columns: columns, spacing: 16) {
                        ForEach(games) { game in
                            GameCardView(item: game)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    if game.displayType == .baseParent {
                                        selectedParentGame = game
                                    } else {
                                        handleHackTap(game)
                                    }
                                }
                                .contextMenu {
                                    if game.displayType == .standaloneHack {
                                        Button("Launch in Emulator") {
                                            handleHackTap(game)
                                        }
                                    }
                                    Button("Push to SD Card") {
                                        // To be implemented by Agent 6
                                    }
                                    Button(role: .destructive, action: {
                                        deleteGame(game)
                                    }) {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Library")
            .sheet(item: $selectedParentGame) { parentGame in
                VariantSelectionSheet(parentGame: parentGame)
            }
            .confirmationDialog("Select Emulator", isPresented: $showingEmulatorPicker, titleVisibility: .visible) {
                ForEach(SupportedEmulator.allCases) { emulator in
                    Button(emulator.displayName) {
                        launch(hack: selectedHack, with: emulator)
                    }
                }
                Button("Share File...", action: {
                    prepareShareSheet(for: selectedHack)
                })
            }
            .sheet(isPresented: $showingShareSheet) {
                if let url = shareURL {
                    ShareSheet(activityItems: [url])
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "An unknown error occurred.")
            }
        }
    }

    private func handleHackTap(_ hack: GameItem) {
        selectedHack = hack
        if let preferred = hack.preferredEmulator, let emulator = SupportedEmulator(rawValue: preferred) {
            launch(hack: hack, with: emulator)
        } else {
            showingEmulatorPicker = true
        }
    }

    private func launch(hack: GameItem?, with emulator: SupportedEmulator) {
        guard let hack = hack else { return }
        Task {
            do {
                try await emulatorService.launchGame(hack, in: emulator)
                hack.preferredEmulator = emulator.rawValue
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }

    private func prepareShareSheet(for hack: GameItem?) {
        guard let hack = hack else { return }
        do {
            let url = try emulatorService.getShareSheetPayload(for: hack)
            shareURL = url
            showingShareSheet = true
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func deleteGame(_ game: GameItem) {
        modelContext.delete(game)
    }
}
