import Foundation
import SwiftData

@Model
public final class GameItem {
    @Attribute(.unique) public var id: UUID
    public var title: String
    public var console: String
    public var displayType: GameDisplayType
    public var localFilePath: String
    public var customBoxArtPath: String?
    public var versionTag: String?
    public var isVanilla: Bool
    public var headerHash: String?

    public var parentGame: GameItem?

    @Relationship(deleteRule: .cascade, inverse: \GameItem.parentGame)
    public var childVariants: [GameItem]

    public init(id: UUID = UUID(),
                title: String,
                console: String,
                displayType: GameDisplayType,
                localFilePath: String,
                customBoxArtPath: String? = nil,
                versionTag: String? = nil,
                isVanilla: Bool = true,
                headerHash: String? = nil,
                parentGame: GameItem? = nil,
                childVariants: [GameItem] = []) {
        self.id = id
        self.title = title
        self.console = console
        self.displayType = displayType
        self.localFilePath = localFilePath
        self.customBoxArtPath = customBoxArtPath
        self.versionTag = versionTag
        self.isVanilla = isVanilla
        self.headerHash = headerHash
        self.parentGame = parentGame
        self.childVariants = childVariants
    }
}
