import Foundation

@objc class FsHelper: NSObject {
    @objc func setupFs(_ skipLogFile: Bool, setupSharedHome shouldSetupSharedHome: Bool) -> [String: String] {
        var home = NSHomeDirectory()
        let sharedURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.keybase")
        var sharedHome = sharedURL?.relativePath ?? ""

        home = setupAppHome(home: home, sharedHome: sharedHome)
        if shouldSetupSharedHome {
            sharedHome = setupSharedHome(home: home, sharedHome: sharedHome)
        }

        let appKeybasePath = Self.getAppKeybasePath()
      // Put logs in a subdir that is entirely background readable
        let oldLogPath = ("~/Library/Caches/Keybase" as NSString).expandingTildeInPath
        let logPath = (oldLogPath as NSString).appendingPathComponent("logs")
        let serviceLogFile = skipLogFile ? "" : (logPath as NSString).appendingPathComponent("ios.log")

        if !skipLogFile {
          // cleanup old log files
            let fm = FileManager.default
            ["ios.log", "ios.log.ek"].forEach {
                try? fm.removeItem(atPath: (oldLogPath as NSString).appendingPathComponent($0))
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
            createBackgroundReadableDirectory(path: (appKeybasePath as NSString).appendingPathComponent($0), setAllFiles: true)
        }

        return [
            "home": home,
            "sharedHome": sharedHome,
            "logFile": serviceLogFile
        ]
    }

    private func addSkipBackupAttribute(to path: String) -> Bool {
        let url = Foundation.URL(fileURLWithPath: path)
        do {
            try (url as NSURL).setResourceValue(true, forKey: URLResourceKey.isExcludedFromBackupKey)
            return true
        } catch {
            NSLog("Error excluding \(url.lastPathComponent) from backup \(error)")
            return false
        }
    }

    private func createBackgroundReadableDirectory(path: String, setAllFiles: Bool) {
        let fm = FileManager.default
        // Setting NSFileProtectionCompleteUntilFirstUserAuthentication makes the
        // directory accessible as long as the user has unlocked the phone once. The
        // files are still stored on the disk encrypted (note for the chat database,
        // it means we are encrypting it twice), and are inaccessible otherwise.
        let noProt = [FileAttributeKey.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        NSLog("creating background readable directory: path: \(path) setAllFiles: \(setAllFiles)")
        _ = try? fm.createDirectory(atPath: path, withIntermediateDirectories: true, attributes: noProt)
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

      // If the caller wants us to set everything in the directory, then let's do it now (one level down at least)
        do {
            let contents = try fm.contentsOfDirectory(atPath: path)
            for file in contents {
                let filePath = (path as NSString).appendingPathComponent(file)
                do {
                    try fm.setAttributes(noProt, ofItemAtPath: filePath)
                } catch {
                    NSLog("Error setting file attributes on file: \(file) error: \(error)")
                }
            }
        } catch {
            NSLog("Error listing directory contents: \(error)")
        }
    }

    private func maybeMigrateDirectory(source: String, dest: String) -> Bool {
        let fm = FileManager.default
        do {
          // Always do this move in case it doesn't work on previous attempts.
            let sourceContents = try fm.contentsOfDirectory(atPath: source)
            for file in sourceContents {
                let path = (source as NSString).appendingPathComponent(file)
                let destPath = (dest as NSString).appendingPathComponent(file)
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
        return ("~/Library/Application Support/Keybase" as NSString).expandingTildeInPath
    }

    @objc static func getEraseableKVPath() -> String {
        return (getAppKeybasePath() as NSString).appendingPathComponent("eraseablekvstore/device-eks")
    }

    private func setupAppHome(home: String, sharedHome: String) -> String {
        let tempUrl = FileManager.default.temporaryDirectory
      // workaround a problem where iOS dyld3 loader crashes if accessing .closure files
       // with complete data protection on
        let dyldDir = (tempUrl.path as NSString).appendingPathComponent("com.apple.dyld")
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
        let sharedKeybasePath = (sharedHome as NSString).appendingPathComponent("Library/Application Support/Keybase")
        let sharedEraseableKVPath = (sharedKeybasePath as NSString).appendingPathComponent("eraseablekvstore/device-eks")

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
