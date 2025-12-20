#!/usr/bin/env node
/**
 * Post-sync script to remove SPM and use pure CocoaPods
 * Capacitor 8 auto-generates Package.swift on sync, but we use CocoaPods only
 * This script cleans up SPM references after each cap sync
 *
 * Usage: node scripts/restore-firebase-spm.js
 * Or use: yarn ios:sync (which runs this automatically)
 */

const fs = require('fs')
const path = require('path')

const IOS_APP_PATH = path.join(__dirname, '../ios/App')
const CAP_APP_SPM_PATH = path.join(IOS_APP_PATH, 'CapApp-SPM')
const PROJECT_PBXPROJ_PATH = path.join(IOS_APP_PATH, 'App.xcodeproj/project.pbxproj')

console.log('🔧 Cleaning up SPM (using pure CocoaPods)...')

// Step 1: Delete CapApp-SPM folder if it exists
if (fs.existsSync(CAP_APP_SPM_PATH)) {
  fs.rmSync(CAP_APP_SPM_PATH, { recursive: true, force: true })
  console.log('✅ Deleted CapApp-SPM folder')
} else {
  console.log('ℹ️  CapApp-SPM folder already removed')
}

// Step 2: Remove SPM references from project.pbxproj
try {
  let pbxproj = fs.readFileSync(PROJECT_PBXPROJ_PATH, 'utf8')
  const originalLength = pbxproj.length

  // Remove CapApp-SPM build file reference
  pbxproj = pbxproj.replace(
    /\s*[A-F0-9]+\s*\/\*\s*CapApp-SPM in Frameworks\s*\*\/\s*=\s*\{[^}]+\};\n?/g,
    ''
  )

  // Remove from Frameworks files array
  pbxproj = pbxproj.replace(
    /\s*[A-F0-9]+\s*\/\*\s*CapApp-SPM in Frameworks\s*\*\/,?\n?/g,
    ''
  )

  // Remove packageProductDependencies
  pbxproj = pbxproj.replace(
    /\s*packageProductDependencies\s*=\s*\(\s*[A-F0-9]+\s*\/\*\s*CapApp-SPM\s*\*\/,?\s*\);\n?/g,
    ''
  )

  // Remove packageReferences
  pbxproj = pbxproj.replace(
    /\s*packageReferences\s*=\s*\(\s*[A-F0-9]+\s*\/\*\s*XCLocalSwiftPackageReference "CapApp-SPM"\s*\*\/,?\s*\);\n?/g,
    ''
  )

  // Remove XCLocalSwiftPackageReference section
  pbxproj = pbxproj.replace(
    /\/\* Begin XCLocalSwiftPackageReference section \*\/[\s\S]*?\/\* End XCLocalSwiftPackageReference section \*\/\n?/g,
    ''
  )

  // Remove XCSwiftPackageProductDependency section
  pbxproj = pbxproj.replace(
    /\/\* Begin XCSwiftPackageProductDependency section \*\/[\s\S]*?\/\* End XCSwiftPackageProductDependency section \*\/\n?/g,
    ''
  )

  if (pbxproj.length !== originalLength) {
    fs.writeFileSync(PROJECT_PBXPROJ_PATH, pbxproj)
    console.log('✅ Removed SPM references from project.pbxproj')
  } else {
    console.log('ℹ️  project.pbxproj already clean (no SPM references)')
  }

  console.log('✅ Pure CocoaPods setup complete!')
} catch (error) {
  console.error('❌ Failed to clean project.pbxproj:', error.message)
  process.exit(1)
}
