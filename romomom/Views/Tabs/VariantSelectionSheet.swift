import SwiftUI
import SwiftData

struct VariantSelectionSheet: View {
    let parentGame: GameItem
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(EmulatorLauncherService.self) private var emulatorService

    @State private var showingEmulatorPicker = false
    @State private var showingShareSheet = false
    @State private var selectedVariant: GameItem?
    @State private var shareURL: URL?
    @State private var errorMessage: String?
    @State private var showingError = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(parentGame.childVariants) { variant in
                    VariantRow(variant: variant)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            handleVariantTap(variant)
                        }
                        .contextMenu {
                            Button("Launch in Emulator") {
                                handleVariantTap(variant)
                            }
                            Button("Push to SD Card") {
                                // Handled in a later task, or a general feature.
                                // Agent 6 note: Add SD Card push logic here.
                            }
                            Button(role: .destructive, action: {
                                deleteVariant(variant)
                            }) {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
            }
            .navigationTitle("\(parentGame.title) Variants")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .confirmationDialog("Select Emulator", isPresented: $showingEmulatorPicker, titleVisibility: .visible) {
                ForEach(SupportedEmulator.allCases) { emulator in
                    Button(emulator.displayName) {
                        launch(variant: selectedVariant, with: emulator)
                    }
                }
                Button("Share File...", action: {
                    prepareShareSheet(for: selectedVariant)
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

    private func handleVariantTap(_ variant: GameItem) {
        selectedVariant = variant
        if let preferred = variant.preferredEmulator, let emulator = SupportedEmulator(rawValue: preferred) {
            launch(variant: variant, with: emulator)
        } else {
            showingEmulatorPicker = true
        }
    }

    private func launch(variant: GameItem?, with emulator: SupportedEmulator) {
        guard let variant = variant else { return }
        Task {
            do {
                try await emulatorService.launchGame(variant, in: emulator)
                variant.preferredEmulator = emulator.rawValue
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }

    private func prepareShareSheet(for variant: GameItem?) {
        guard let variant = variant else { return }
        do {
            let url = try emulatorService.getShareSheetPayload(for: variant)
            shareURL = url
            showingShareSheet = true
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }

    private func deleteVariant(_ variant: GameItem) {
        modelContext.delete(variant)
    }
}

struct VariantRow: View {
    let variant: GameItem

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(variant.title)
                    .font(.body)
                if let version = variant.versionTag {
                    Text(version)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            if let emulatorStr = variant.preferredEmulator, let emulator = SupportedEmulator(rawValue: emulatorStr) {
                Text(emulator.displayName)
                    .font(.caption2)
                    .padding(4)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
            }
        }
        .padding(.vertical, 4)
    }
}
