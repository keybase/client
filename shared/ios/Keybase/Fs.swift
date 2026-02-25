import Foundation
import os

private let log = Logger(subsystem: "com.keybase.app", category: "fs")

@objc class FsHelper: NSObject {
    private static let cacheKeybaseURL = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Caches/Keybase")
    private static let appSupportKeybaseURL = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support/Keybase")

    @objc func setupFs(_ skipLogFile: Bool, setupSharedHome shouldSetupSharedHome: Bool) -> [String: String] {
        let setupFsStartTime = CFAbsoluteTimeGetCurrent()
        log.info("setupFs: starting")

        var home = NSHomeDirectory()
        let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.keybase")
        var sharedHome = sharedURL?.path ?? ""

        home = setupAppHome(home: home, sharedHome: sharedHome)
        if shouldSetupSharedHome {
            sharedHome = setupSharedHome(home: home, sharedHome: sharedHome)
        }

        let appKeybaseURL = URL(fileURLWithPath: Self.getAppKeybasePath())
        // Put logs in a subdir that is entirely background readable
        let logURL = Self.cacheKeybaseURL.appendingPathComponent("logs")
        let serviceLogFile = skipLogFile ? "" : logURL.appendingPathComponent("ios.log").path

        if !skipLogFile {
            // cleanup old log files
            let fm = FileManager.default
            ["ios.log", "ios.log.ek"].forEach {
                try? fm.removeItem(at: Self.cacheKeybaseURL.appendingPathComponent($0))
            }
        }
        // Create LevelDB and log directories with a slightly lower data protection
        // mode so we can use them in the background
        [
            "keybase.chat.leveldb",
            "keybase.leveldb",
            "kbfs_block_cache",
            "kbfs_block_metadata",
            "kbfs_conflicts",
            "kbfs_favorites",
            "kbfs_journal",
            "kbfs_md_cache",
            "kbfs_quota_cache",
            "kbfs_sync_cache",
            "kbfs_settings",
            "synced_tlf_config",
            "logs"
        ].forEach {
            createBackgroundReadableDirectory(path: appKeybaseURL.appendingPathComponent($0).path, setAllFiles: true)
        }
        // Mark avatars, which are in the caches dir
        createBackgroundReadableDirectory(path: Self.cacheKeybaseURL.appendingPathComponent("avatars").path, setAllFiles: true)

        let setupFsElapsed = CFAbsoluteTimeGetCurrent() - setupFsStartTime
        log.info("setupFs: completed in \(setupFsElapsed, format: .fixed(precision: 3)) seconds")

        return [
            "home": home,
            "sharedHome": sharedHome,
            "logFile": serviceLogFile
        ]
    }

    private func addSkipBackupAttribute(to path: String) -> Bool {
        var url = URL(fileURLWithPath: path)
        do {
            var resourceValues = URLResourceValues()
            resourceValues.isExcludedFromBackup = true
            try url.setResourceValues(resourceValues)
            return true
        } catch {
            log.error("Error excluding \(url.lastPathComponent, privacy: .public) from backup \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    private func createBackgroundReadableDirectory(path: String, setAllFiles: Bool) {
        let dirStartTime = CFAbsoluteTimeGetCurrent()
        let fm = FileManager.default
        // Setting NSFileProtectionCompleteUntilFirstUserAuthentication makes the
        // directory accessible as long as the user has unlocked the phone once. The
        // files are still stored on the disk encrypted (note for the chat database,
        // it means we are encrypting it twice), and are inaccessible otherwise.
        let noProt = [FileAttributeKey.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        log.info("creating background readable directory: path: \(path, privacy: .public) setAllFiles: \(setAllFiles)")
        _ = try? fm.createDirectory(atPath: path, withIntermediateDirectories: true, attributes: noProt)
        do {
            try fm.setAttributes(noProt, ofItemAtPath: path)
        } catch {
            log.error("Error setting file attributes on path: \(path, privacy: .public) error: \(error.localizedDescription, privacy: .public)")
        }

        guard setAllFiles else {
            log.info("setAllFiles is false, so returning now")
            return
        }
        log.info("setAllFiles is true charging forward")

        // Recursively set attributes on all subdirectories and files
        let pathURL = URL(fileURLWithPath: path)
        var fileCount = 0
        if let enumerator = fm.enumerator(atPath: path) {
            for case let file as String in enumerator {
                let filePath = pathURL.appendingPathComponent(file).path
                do {
                    try fm.setAttributes(noProt, ofItemAtPath: filePath)
                    fileCount += 1
                } catch {
                    log.error("Error setting file attributes on: \(filePath, privacy: .public) error: \(error.localizedDescription, privacy: .public)")
                }
            }
            let dirElapsed = CFAbsoluteTimeGetCurrent() - dirStartTime
            log.info("createBackgroundReadableDirectory completed for: \(path, privacy: .public), processed \(fileCount) files, total: \(dirElapsed, format: .fixed(precision: 3)) seconds")
        } else {
            log.error("Error creating enumerator for path: \(path, privacy: .public)")
        }
    }

    private func maybeMigrateDirectory(source: String, dest: String) -> Bool {
        let fm = FileManager.default
        let sourceURL = URL(fileURLWithPath: source)
        let destURL = URL(fileURLWithPath: dest)
        do {
          // Always do this move in case it doesn't work on previous attempts.
            let sourceContents = try fm.contentsOfDirectory(atPath: source)
            for file in sourceContents {
                let filePath = sourceURL.appendingPathComponent(file).path
                let destPath = destURL.appendingPathComponent(file).path
                var isDir: ObjCBool = false
                if fm.fileExists(atPath: filePath, isDirectory: &isDir), isDir.boolValue {
                    log.info("skipping directory: \(file, privacy: .public)")
                    continue
                }
                do {
                    try fm.moveItem(atPath: filePath, toPath: destPath)
                } catch let error as NSError {
                    if error.code == NSFileWriteFileExistsError {
                        continue
                    }
                    log.error("Error moving file: \(file, privacy: .public) error: \(error.localizedDescription, privacy: .public)")
                    return false
                }
            }
            return true
        } catch {
            log.error("Error listing app contents directory: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    @objc static func getAppKeybasePath() -> String {
        return appSupportKeybaseURL.path
    }

    @objc static func getEraseableKVPath() -> String {
        return appSupportKeybaseURL.appendingPathComponent("eraseablekvstore/device-eks").path
    }

    private func setupAppHome(home: String, sharedHome: String) -> String {
        let dyldDir = FileManager.default.temporaryDirectory.appendingPathComponent("com.apple.dyld").path
        let appKeybasePath = Self.getAppKeybasePath()
        let appEraseableKVPath = Self.getEraseableKVPath()

        createBackgroundReadableDirectory(path: dyldDir, setAllFiles: true)
        createBackgroundReadableDirectory(path: appKeybasePath, setAllFiles: true)
        createBackgroundReadableDirectory(path: appEraseableKVPath, setAllFiles: true)
        _ = addSkipBackupAttribute(to: appKeybasePath)

        return home
    }

    private func setupSharedHome(home: String, sharedHome: String) -> String {
        let appKeybasePath = Self.getAppKeybasePath()
        let appEraseableKVPath = Self.getEraseableKVPath()
        let sharedKeybasePath = URL(fileURLWithPath: sharedHome).appendingPathComponent("Library/Application Support/Keybase").path
        let sharedEraseableKVPath = URL(fileURLWithPath: sharedKeybasePath).appendingPathComponent("eraseablekvstore/device-eks").path

        createBackgroundReadableDirectory(path: sharedKeybasePath, setAllFiles: true)
        createBackgroundReadableDirectory(path: sharedEraseableKVPath, setAllFiles: true)
        _ = addSkipBackupAttribute(to: sharedKeybasePath)

        guard maybeMigrateDirectory(source: appKeybasePath, dest: sharedKeybasePath),
              maybeMigrateDirectory(source: appEraseableKVPath, dest: sharedEraseableKVPath) else {
            return home
        }

        return sharedHome
    }
}
