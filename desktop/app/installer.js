import {app} from 'electron';
import {exec} from 'child_process';
import path from 'path';
import fs from 'fs';

import {runMode} from '../shared/constants/platform.native.desktop'

export default (callback) => {
  const appPath = app.getAppPath()
  // For testing when running manually via npm start
  // const appPath = "/Applications/Keybase.app/Contents/Resources/app/"
  // For testing running from DMG
  // const appPath = "/Volumes/Keybase/Keybase.app/Contents/Resources/app/"

  const resourcesPath = path.resolve(appPath, "..")
  const appBundlePath = path.resolve(appPath, "..", "..", "..")
  const installerExec = path.resolve(resourcesPath, "KeybaseInstaller.app", "Contents", "MacOS", "Keybase")

  fs.access(installerExec, fs.X_OK , function (err) {
    if (runMode != "prod") {
      // Only run in prod
      console.log("Installer not available for this run mode (%s)", runMode)
      callback(null);
      return
    }

    if (err) {
      // Installer is not accessible
      console.log("Installer not found (%s)", installerExec)
      callback(null);
      return
    }

    var cmd = [installerExec, "--app-path="+appBundlePath, "--run-mode="+runMode].join(" ")
    exec(cmd, function(execErr, stdout, stderr) {
      if (execErr) {
        console.log("Installer (err):", execErr)
        if (execErr.code == 1) {
          // Quit
          app.quit()
        } else if (execErr.code == 2) {
          // TODO: Show error details
        }
        callback(execErr)
        return
      }

      console.log("Installer (stdout):", stdout)
      console.log("Installer (stderr):", stderr)
      callback(null)
    });
  });

}
