// swift-tools-version:5.9
// Host-side tests for the share code that doesn't need UIKit. The app builds
// these sources through KBCommon.podspec; this package only exists for
// `swift test`.
import PackageDescription

let package = Package(
  name: "KBCommonShare",
  platforms: [.macOS(.v13)],
  targets: [
    .target(
      name: "KBCommonShare",
      path: "src",
      exclude: ["ItemProviderHelper.swift", "MediaUtils.swift"],
      sources: ["ShareFiles.swift", "PayloadFileName.swift"]
    ),
    .testTarget(
      name: "ShareFilesTests",
      dependencies: ["KBCommonShare"],
      path: "Tests/ShareFilesTests"
    ),
  ]
)
