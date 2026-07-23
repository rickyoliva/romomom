# Project Specification: iOS Retro Library & ROM Hack Manager

## Core Tech Stack & Requirements
- **Target OS:** iOS 17.0+ (SwiftData, `@Observable` macro)
- **Frameworks:** SwiftUI, SwiftData, WebKit, UniformTypeIdentifiers, Foundation
- **Architecture:** MVVM / Unidirectional flow using SwiftData as the source of truth

## App Core Features
1. **Centralized Library (Sandbox):**
   - Main storage resides in the App Sandbox (`Application Support` / local documents).
   - `GameItem` model with `displayType` (`.baseParent` vs `.standaloneHack`).
   - Supports parent/child relationships (`parentGame` / `childVariants`).
   - Parent Base Games act as folders/cards rendering nested variants on tap.

2. **Embedded JavaScript Patcher:**
   - Execute `RomPatcher.js` inside a headless `WKWebView` background bridge.
   - Accepts base `.gba`/`.nds` files + `.bps`/`.ips` patches, outputs patched file bytes natively.

3. **External SD Card Management:**
   - Granular push model using `FileManager` and `startAccessingSecurityScopedResource()`.
   - Security-scoped URL bookmarks for removable Lightning/USB-C SD cards.

4. **Emulator Deep-Linking:**
   - Launch games directly via URL schemes (`delta://`, `retroarch://`) with fallback share sheets.
