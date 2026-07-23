import SwiftUI

struct GameCardView: View {
    let item: GameItem

    var body: some View {
        VStack {
            ZStack {
                // Background Gradient
                LinearGradient(
                    gradient: Gradient(colors: [Color.blue.opacity(0.3), Color.purple.opacity(0.3)]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                // Box Art or Fallback
                if let path = item.customBoxArtPath, let uiImage = UIImage(contentsOfFile: path) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: item.displayType == .baseParent ? "folder.fill" : "gamecontroller.fill")
                        .resizable()
                        .scaledToFit()
                        .padding(32)
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .frame(height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(radius: 4)

            // Text Info
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.headline)
                    .lineLimit(1)

                HStack {
                    Text(item.console.uppercased())
                        .font(.caption)
                        .fontWeight(.bold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.3))
                        .clipShape(Capsule())

                    Spacer()

                    if item.displayType == .baseParent {
                        Text("\(item.childVariants.count) variants")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
        }
    }
}
