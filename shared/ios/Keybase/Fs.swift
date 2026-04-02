import Foundation

@objc class FsHelper: NSObject {
    @objc func setupFs(_ skipLogFile: Bool, setupSharedHome shouldSetupSharedHome: Bool) -> [String:
        String]
    {
        let setupFsStartTime = CFAbsoluteTimeGetCurrent()
        NSLog("setupFs: starting")

        var home = NSHomeDirectory()
        let sharedURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.keybase")
        var sharedHome = sharedURL?.relativePath ?? ""

        home = setupAppHome(home: home, sharedHome: sharedHome)
        if shouldSetupSharedHome {
            sharedHome = setupSharedHome(home: home, sharedHome: sharedHome)
        }

        let appKeybasePath = Self.getAppKeybasePath()
        // Put logs in a subdir that is entirely background readable
        let oldLogURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Keybase")
        let serviceLogFile =
            skipLogFile
            ? ""
            : oldLogURL
                .appendingPathComponent("logs")
                .appendingPathComponent("ios.log").path

        let logDirURL = oldLogURL.appendingPathComponent("logs")
        if !skipLogFile {
            // cleanup old log files (they live in the logs/ subdir, not directly under oldLogURL)
            let fm = FileManager.default
            ["ios.log", "ios.log.ek"].forEach {
                try? fm.removeItem(at: logDirURL.appendingPathComponent($0))
            }
        }
        // Create LevelDB and log directories with a slightly lower data protection
        // mode so we can use them in the background
        let appKeybaseURL = URL(fileURLWithPath: appKeybasePath)
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
        ].forEach {
            createBackgroundReadableDirectory(
                path: appKeybaseURL.appendingPathComponent($0).path, setAllFiles: true)
        }
        // Log and avatar dirs live under the caches dir, not Application Support.
        // This must run after the cleanup above so that any surviving ios.log from a
        // previous session (created by Go with default FileProtectionComplete) has its
        // protection downgraded to completeUntilFirstUserAuthentication before
        // KeybaseInit tries to open it on a locked device.
        createBackgroundReadableDirectory(path: logDirURL.path, setAllFiles: true)
        createBackgroundReadableDirectory(
            path: oldLogURL.appendingPathComponent("avatars").path, setAllFiles: true)

        let setupFsElapsed = CFAbsoluteTimeGetCurrent() - setupFsStartTime
        NSLog("setupFs: completed in %.3f seconds", setupFsElapsed)

        return [
            "home": home,
            "sharedHome": sharedHome,
            "logFile": serviceLogFile,
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
            NSLog("Error excluding \(url.lastPathComponent) from backup \(error)")
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
        let noProt = [
            FileAttributeKey.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication
        ]
        NSLog("creating background readable directory: path: \(path) setAllFiles: \(setAllFiles)")
        _ = try? fm.createDirectory(
            atPath: path, withIntermediateDirectories: true, attributes: noProt)
        do {
            try fm.setAttributes(noProt, ofItemAtPath: path)
        } catch {
            NSLog("Error setting file attributes on path: \(path) error: \(error)")
        }

        guard setAllFiles else {
            NSLog("setAllFiles is false, so returning now")
            return
        }
        NSLog("setAllFiles is true charging forward")

        // Recursively set attributes on all subdirectories and files
        let baseURL = URL(fileURLWithPath: path)
        var fileCount = 0
        if let enumerator = fm.enumerator(atPath: path) {
            for case let file as String in enumerator {
                let filePath = baseURL.appendingPathComponent(file).path
                do {
                    try fm.setAttributes(noProt, ofItemAtPath: filePath)
                    fileCount += 1
                } catch {
                    NSLog("Error setting file attributes on: \(filePath) error: \(error)")
                }
            }
            let dirElapsed = CFAbsoluteTimeGetCurrent() - dirStartTime
            NSLog(
                "createBackgroundReadableDirectory completed for: \(path), processed \(fileCount) files, total: %.3f seconds",
                dirElapsed)
        } else {
            NSLog("Error creating enumerator for path: \(path)")
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
                let path = sourceURL.appendingPathComponent(file).path
                let destPath = destURL.appendingPathComponent(file).path
                var isDir: ObjCBool = false
                if fm.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue {
                    NSLog("skipping directory: \(file)")
                    continue
                }
                do {
                    try fm.moveItem(atPath: path, toPath: destPath)
                } catch let error as NSError {
                    if error.code == NSFileWriteFileExistsError {
                        continue
                    }
                    NSLog("Error moving file: \(file) error: \(error)")
                    return false
                }
            }
            return true
        } catch {
            NSLog("Error listing app contents directory: \(error)")
            return false
        }
    }

    @objc static func getAppKeybasePath() -> String {
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Keybase").path
    }

    @objc static func getEraseableKVPath() -> String {
        return URL(fileURLWithPath: getAppKeybasePath())
            .appendingPathComponent("eraseablekvstore/device-eks").path
    }

    private func setupAppHome(home: String, sharedHome: String) -> String {
        let tempUrl = FileManager.default.temporaryDirectory
        // workaround a problem where iOS dyld3 loader crashes if accessing .closure files
        // with complete data protection on
        let dyldDir = tempUrl.appendingPathComponent("com.apple.dyld").path
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
        let sharedKeybasePath = URL(fileURLWithPath: sharedHome)
            .appendingPathComponent("Library/Application Support/Keybase").path
        let sharedEraseableKVPath = URL(fileURLWithPath: sharedKeybasePath)
            .appendingPathComponent("eraseablekvstore/device-eks").path

        createBackgroundReadableDirectory(path: sharedKeybasePath, setAllFiles: true)
        createBackgroundReadableDirectory(path: sharedEraseableKVPath, setAllFiles: true)
        _ = addSkipBackupAttribute(to: sharedKeybasePath)

        guard maybeMigrateDirectory(source: appKeybasePath, dest: sharedKeybasePath),
            maybeMigrateDirectory(source: appEraseableKVPath, dest: sharedEraseableKVPath)
        else {
            return home
        }

        return sharedHome
    }
}
