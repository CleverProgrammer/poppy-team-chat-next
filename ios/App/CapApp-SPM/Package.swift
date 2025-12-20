// swift-tools-version: 5.9
import PackageDescription

// Using CocoaPods for all dependencies - this file is kept as a minimal stub
// All Capacitor plugins and Firebase are managed via Podfile
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: []
        )
    ]
)
