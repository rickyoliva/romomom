# PROGRESS_LOG.md

## Initial Setup
- Initialized PROGRESS_LOG.md.

## SwiftData Setup (iOS 17.0+)
- Added `romomom/Models/GameDisplayType.swift` enum (conforms to Codable) with `.baseParent` and `.standaloneHack`.
- Added `romomom/Models/GameItem.swift` SwiftData `@Model` class. Includes necessary properties: id, title, console, displayType, localFilePath, customBoxArtPath, versionTag, isVanilla, headerHash. Added `parentGame` and a `childVariants` array with a cascade delete relationship.
- Created `romomom/romomomApp.swift` acting as the app entry point. Initialized `ModelContainer` and attached it via `.modelContainer(sharedModelContainer)`.
- Created `romomom/ContentView.swift` as a basic placeholder UI.

**Note to Agent 2:**
The primary data models are now in place. `GameItem` instances will act as the source of truth for the library. For the WKWebView Patcher Service, you'll need to read/write local file URLs mapped to these entries (see `localFilePath`). Ensure you coordinate JavaScript message handling so when a patch is applied, we can instantiate a new `GameItem` variant (with `displayType = .standaloneHack` and linked to its `parentGame`).

## WKWebView JavaScript Patcher Service (iOS 17.0+)
- Added Marc Robledo's `RomPatcher.js` and its modules directly into the project bundle under `romomom/Resources/rom-patcher-js/` for offline patching.
- Added `romomom/Resources/patcher.html` as the local wrapper to execute patching requests and communicate over a `WKScriptMessageHandler`.
- Created `romomom/Services/PatcherService.swift` containing an `@Observable` service `PatcherService`.
- Built the WKWebView Headless Bridge:
  - `PatcherService` creates a fresh, hidden `WKWebView` per patching request.
  - Implemented `applyPatch(baseRomData: patchData: patchType:)` for in-memory operations.
  - Added `applyPatchAndSave(baseRomURL: patchURL:)` to write patched data directly to the App Sandbox temporary directory, reducing memory load for large titles.
  - Included a format validation check for "ips", "bps", and "xdelta" using extensions and header signatures.
  - Ensures the WKWebView is gracefully torn down after every patch completion.

**Note to Agent 3 (Security-Scoped SD Card Storage Manager):**
The `PatcherService` is complete and handles all raw bytes/file conversion via `RomPatcher.js`. It writes resulting patched ROMs directly to the App Sandbox temp directory. As you build the External SD Card Management, ensure that whenever a patch is applied to a base game stored externally on an SD card, the resulting patched file is moved from the temporary directory into either local app storage or the SD card (based on your architecture decisions). Ensure all SD card access retains security-scoped URL bookmarks correctly.

## Security-Scoped External SD Card Storage Manager (iOS 17.0+)
- Created `romomom/Services/SDCardStorageManager.swift` using the `@Observable` macro to manage external SD card operations via Lightning/USB-C adapters.
- Implemented persistent security-scoped bookmark loading/saving logic utilizing `UserDefaults` so the app maintains continuous access to the selected external directory across launches.
- Added `getDestinationFolder(for console: String)` to resolve or automatically create destination directories like `/roms/nds` and `/roms/gba` on the SD card root.
- Created `pushVariantToSDCard(variant: GameItem, destinationConsoleFolder: String)` which implements granular file copying via atomic operations (copies file to a `.tmp` file on target directory, then securely renames/moves it to final destination).
- Implemented `getExistingSDCardFiles(for console: String)` to perform a shallow directory listing to support pre-transfer diffing/conflict checking.
- Ensured all file operations robustly wrap `.startAccessingSecurityScopedResource()` and `.stopAccessingSecurityScopedResource()` in `defer` blocks to prevent external storage access leaks.
- Designed comprehensive error handling through an `SDCardError` enum (e.g. `.bookmarkFailed`, `.accessDenied`, `.fileAlreadyExists`, `.sourceFileNotFound`, `.transferFailed`).

**Note to Agent 4 (Emulator Deep-Linking Launcher Service):**
The external SD Card Storage Manager is fully operational. Whenever the user needs to launch a game stored on the external SD card, use `SDCardStorageManager` to resolve and provide access to the file paths. Emulators launched via deep-linking might require access to these resolved security-scoped URLs or path translations depending on their exact capabilities. Keep in mind that some external SD card files might require a fallback share sheet if deep-linking is unsupported or access fails.

## Emulator Deep-Linking Launcher Service (iOS 17.0+)
- Created `romomom/Info.plist` with standard `LSApplicationQueriesSchemes` configuration to support querying `delta`, `retroarch`, `ignited`, `ppsspp`, and `folium`.
- Created `romomom/Services/EmulatorLauncherService.swift` using the `@Observable` macro to manage external emulator launching.
- Implemented `SupportedEmulator` enum to represent target emulators with their associated URL schemes and display names.
- Added `getShareSheetPayload(for variant: GameItem) -> URL` to securely copy source ROMs from internal/external paths to `FileManager.default.temporaryDirectory` with sanitized, human-readable file names. This bypasses iOS sandboxing restrictions for external apps and ensures clean exports via fallback share sheets.
- Created `canOpenEmulator(_ emulator: SupportedEmulator) -> Bool` to verify installation status via `UIApplication.shared.canOpenURL`.
- Implemented `launchGame(_ variant: GameItem, in emulator: SupportedEmulator)` which prepares the temporary file payload, constructs a query string (`scheme://open?path=...`), and attempts the deep-link launch, with a fallback to launch the root app scheme if direct file opening fails.

**Note to Agent 5 (UI Integration):**
The primary core services are now complete: Data models (`GameItem`), JavaScript Patcher (`PatcherService`), SD Card Storage Manager (`SDCardStorageManager`), and Emulator Launcher (`EmulatorLauncherService`).
The next step is to build the SwiftUI views that consume these services. Use `EmulatorLauncherService` to attempt deep-links to installed emulators. If `launchGame` throws an error, or if you want to provide a manual export option, use `getShareSheetPayload` to retrieve a clean file URL to pass into a `UIActivityViewController` share sheet.

## Main Library UI & Navigation (iOS 17.0+)
- Added `preferredEmulator: String?` to `GameItem.swift` to save default emulator preferences on a per-variant basis.
- Set up global environment services by instantiating `@Observable` singletons for `PatcherService`, `SDCardStorageManager`, and `EmulatorLauncherService` in `romomomApp.swift` and injecting them into the view hierarchy.
- Created `romomom/Views/Components/ShareSheet.swift` mapping `UIActivityViewController` to handle fallback ROM exports when emulator deep-linking is unsupported.
- Built `romomom/Views/Components/GameCardView.swift` implementing an aesthetic card layout with conditional box art fallbacks utilizing a stylized system image over a linear gradient.
- Developed `romomom/Views/Tabs/MainLibraryView.swift` leveraging SwiftData `@Query` to separate and render `.baseParent` and `.standaloneHack` instances on a responsive `LazyVGrid`.
- Added `romomom/Views/Tabs/VariantSelectionSheet.swift` for presenting nested child variants in a clean `.sheet` modal interface, exposing emulator launch and context actions.
- Built `romomom/Views/Tabs/SDCardView.swift` utilizing `SDCardStorageManager` and a functional `.fileImporter` to allow users to securely mount SD card directories and preview discovered file contents.
- Constructed `romomom/Views/Tabs/PatcherView.swift` integrating `.fileImporter` pickers for both Base ROMs and Patches. It orchestrates the background `PatcherService`, captures the native byte output, and cleanly inserts a newly instantiated `GameItem` variant back into SwiftData.
- Linked all modules together inside `romomom/Views/Tabs/MainTabView.swift`.

**Note to Agent 6 (Polish & Settings):**
The core UI flows, tab navigation, and `.fileImporter` file pickers are fully operational.
1. The "Push to SD Card" context menu action in `MainLibraryView` and `VariantSelectionSheet` is currently stubbed out. Please wire this up to `SDCardStorageManager.pushVariantToSDCard`.
2. The current UI is functional but could use final polish (animations, empty states, dedicated app settings).
3. Ensure any SD Card permission edge cases are handled correctly across app lifecycles.

## Manual Document Import & Archive Handler (iOS 17.0+)
- Created `romomom/Services/DocumentImportService.swift` as an `@Observable` singleton managing file imports.
- Implemented `importLocalFile` securely utilizing `startAccessingSecurityScopedResource()` to ingest external files and archives.
- Integrated `SWCompression` for `.zip` and `.7z` extraction. Wrote logic to extract into a temporary directory and identify valid ROM files by their extensions.
- Evaluated base ROMs mathematically via native `CryptoKit` (`Insecure.MD5`) and C-interoperability `zlib` (`crc32`) to compute `md5` and `crc32` metadata hashes.
- Automatically instantiates new `GameItem` objects and copies extracted uncompressed ROM payloads into the `Application Support`/`Documents` app sandbox.
- Updated `romomomApp.swift` to initialize `DocumentImportService` and inject it globally into the SwiftUI environment.
- Updated `romomom/Views/Tabs/MainLibraryView.swift` and `romomom/Views/Tabs/PatcherView.swift` to include a trailing navigation bar `+` "Import File" button leveraging `.fileImporter` that accepts archives and raw ROM/patch formats, mapping directly into the service.

**Note to Agent 7 (Remote API Repository & Download Manager):**
The manual document import handling is complete. When you build the remote download manager to fetch files, note that you can reuse logic (or interface with) `DocumentImportService` if you end up downloading zipped or compressed ROMs/patches to process them identically. Ensure any network connections you implement account for correct SwiftData threaded execution contexts.

## Pivot to React Native / Expo (Cross-Platform)
- Updated `AGENTS.md` to establish new architecture guidelines based on React Native, Expo SDK 51+, TypeScript, and Expo Router.
- Initialized a new Expo blank-typescript project in the repository root.
- Kept the original `romomom` folder containing the Swift/SwiftUI implementation for reference.
- Installed required Expo modules (`expo-file-system`, `expo-document-picker`, `expo-sqlite`, `expo-sharing`, `expo-linking`, `expo-router`).
- Configured Expo Router entry point in `package.json` and deleted `App.tsx`/`index.ts`.
- Set up foundational file-based navigation in `app/`:
  - `app/_layout.tsx` (Root Layout)
  - `app/(tabs)/_layout.tsx` (Tab Configuration)
  - `app/(tabs)/index.tsx` (Library Tab)
  - `app/(tabs)/storage.tsx` (Storage Tab)
  - `app/(tabs)/patcher.tsx` (Patcher Tab)

**Note to Agent 2 (Core Data Schema & Direct JS Patcher):**
The Expo environment is initialized and ready. Your primary task is to port the SwiftData `GameItem` schema over to `expo-sqlite` (or a chosen state wrapper like Zustand if you prefer purely local app sandbox storage without sqlite). Additionally, you must implement the direct JavaScript patching service. Note the architecture rule change: we no longer use a hidden WebView (`WKWebView`). `RomPatcher.js` must be adapted or executed natively in the React Native JS thread.

## Core Data Schema & Direct JS Patcher (Expo / React Native)
- Established the SQLite storage layer in `src/db/database.ts` and `src/db/gameRepository.ts` using `expo-sqlite`.
- Defined the `games` table schema supporting base parent folders, standalone hacks, and child variants, adhering to the requested fields (id, title, displayType, parentGameId, localFilePath, customBoxArtPath, console, updatedAt).
- Implemented core CRUD repository methods: `getAllGames()`, `getVariantsForParent()`, `insertGame()`, and `deleteGame()`.
- Built the Pure JavaScript Patcher Service in `src/services/patcherService.ts`.
- Integrated Marc Robledo's `RomPatcher.js` natively into the JS environment, converting the previously WebView-bound process into direct node/expo JS execution.
- Configured the patcher to read `.bps` and `.ips` binaries using `expo-file-system`, process patches using TypedArrays/ArrayBuffers, save outputs natively, and log the generated variant to SQLite.

**Note to Agent 3 (File Storage & External SD Card Manager):**
The SQLite database and the native JS patcher are complete. The patcher successfully writes outputs to the app's document directory via `expo-file-system`. As you build the File Storage & External SD Card Manager, ensure you handle cross-referencing these paths. When moving patched ROMs or interacting with SD cards via native bridging, coordinate with the paths stored in SQLite (`localFilePath`). Ensure external files securely sync or copy locally before patching, or natively support streaming into the patcher buffer array.

## File Import & Storage Service (Expo / React Native)
- Updated `games` SQLite table schema to support `'Unknown'` console types and a new `fileHash` field for ROM validation.
- Built `src/services/storageService.ts` to manage document selection via `expo-document-picker`.
- Handled raw and archived (`.zip`) ROM imports using `expo-file-system`, `jszip`, and `buffer` to safely extract payload binaries into the app's document directory (`/roms`).
- Calculated MD5 hashes natively via `expo-crypto` during the ingest process and logged the resulting `Game` to SQLite.
- Developed `src/services/emulatorLauncherService.ts` to orchestrate app deep-linking via `expo-linking` for emulators like Delta, RetroArch, Ignited, PPSSPP, and Folium.
- Integrated a seamless fallback to the native share sheet via `expo-sharing` if a target emulator scheme fails or is uninstalled.
- Wired up a preliminary UI in `app/(tabs)/storage.tsx` to validate file picking, database insertions, directory listings, storage statistics reporting, and launcher functionality.

**Note to Agent 4 (Library Grid & UI Integration):**
The core underlying services are complete (DB, Patcher, Storage, Emulator Launcher). Your job is to build the visual Library Grid (`app/(tabs)/index.tsx`). Use `getAllGames()` and `getVariantsForParent()` from the `gameRepository` to populate the list. Hook up user taps on game items to trigger `launchGame(localFilePath, emulatorScheme)` from the `emulatorLauncherService`. Ensure the UI gracefully handles both standalone and parent/child variant relationships visually.
