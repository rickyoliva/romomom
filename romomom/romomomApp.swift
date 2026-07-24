import SwiftUI
import SwiftData

@main
struct romomomApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            GameItem.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    @State private var patcherService = PatcherService()
    @State private var sdCardStorageManager = SDCardStorageManager()
    @State private var emulatorLauncherService = EmulatorLauncherService()
    @State private var documentImportService = DocumentImportService()

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
        .modelContainer(sharedModelContainer)
        .environment(patcherService)
        .environment(sdCardStorageManager)
        .environment(emulatorLauncherService)
        .environment(documentImportService)
    }
}
