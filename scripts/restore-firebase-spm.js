#!/usr/bin/env node
/**
 * Post-sync script to maintain Package.swift as minimal stub
 * We now use CocoaPods for all native iOS dependencies (including Firebase)
 * This script ensures Package.swift stays minimal after cap sync
 *
 * Usage: node scripts/restore-firebase-spm.js
 * Or use: yarn ios:sync (which runs this automatically)
 */

const fs = require('fs')
const path = require('path')

const PACKAGE_SWIFT_PATH = path.join(__dirname, '../ios/App/CapApp-SPM/Package.swift')

// Minimal stub - all deps managed via Podfile (CocoaPods)
const CORRECT_PACKAGE_SWIFT = `// swift-tools-version: 5.9
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
`

console.log('🔧 Ensuring Package.swift is minimal (CocoaPods mode)...')

try {
  fs.writeFileSync(PACKAGE_SWIFT_PATH, CORRECT_PACKAGE_SWIFT)
  console.log('✅ Package.swift is now minimal - all deps via CocoaPods!')
} catch (error) {
  console.error('❌ Failed to update Package.swift:', error.message)
  process.exit(1)
}
