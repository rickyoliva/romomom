import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            MainLibraryView()
                .tabItem {
                    Label("Library", systemImage: "books.vertical.fill")
                }

            SDCardView()
                .tabItem {
                    Label("SD Card", systemImage: "externaldrive.fill")
                }

            PatcherView()
                .tabItem {
                    Label("Patcher", systemImage: "hammer.fill")
                }
        }
    }
}
