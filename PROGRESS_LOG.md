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
