#!/usr/bin/env node
/**
 * Post-sync script to restore Firebase SDK to Package.swift
 * Run this after `npx cap sync ios` to fix the Firebase SDK being removed
 *
 * Usage: node scripts/restore-firebase-spm.js
 * Or use: yarn ios:sync (which runs this automatically)
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_SWIFT_PATH = path.join(__dirname, '../ios/App/CapApp-SPM/Package.swift');

const CORRECT_PACKAGE_SWIFT = `// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
// Note: Firebase SDK added manually for push notifications
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.0"),
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0"),
        .package(name: "CapacitorActionSheet", path: "../../../node_modules/@capacitor/action-sheet"),
        .package(name: "CapacitorBrowser", path: "../../../node_modules/@capacitor/browser"),
        .package(name: "CapacitorHaptics", path: "../../../node_modules/@capacitor/haptics"),
        .package(name: "CapacitorKeyboard", path: "../../../node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorLocalNotifications", path: "../../../node_modules/@capacitor/local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "../../../node_modules/@capacitor/push-notifications")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "CapacitorActionSheet", package: "CapacitorActionSheet"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications")
            ]
        )
    ]
)
`;

console.log('🔧 Restoring Firebase SDK to Package.swift...');

try {
  fs.writeFileSync(PACKAGE_SWIFT_PATH, CORRECT_PACKAGE_SWIFT);
  console.log('✅ Firebase SDK restored successfully!');
} catch (error) {
  console.error('❌ Failed to restore Firebase SDK:', error.message);
  process.exit(1);
}
