import {app} from 'electron';
import {exec} from 'child_process';
import path from 'path';
import fs from 'fs';

import {runMode} from '../../react-native/react/constants/platform.native.desktop'

export default (callback) => {
  const appPath = app.getAppPath()
  const resourcesPath = path.resolve(appPath, "..")
  const appBundlePath = path.resolve(appPath, "..", "..", "..")
  const installerExec = path.resolve(resourcesPath, "KeybaseInstaller.app", "Contents", "MacOS", "Keybase")

  fs.access(installerExec, fs.X_OK , function (err) {
    if (runMode != "prod") {
      // Only run in prod
      console.log("Installer not available (runMode=%s)", runMode)
      callback(null);
      return
    }

    if (err) {
      // Installer is not accessible
      console.log("Installer not available (not found)")
      callback(null);
      return
    }

    var cmd = [installerExec, "--app-path="+appBundlePath, "--run-mode=prod"].join(" ");
    exec(cmd, function(err, stdout, stderr) {
      console.log("Installer: ", err, stdout, stderr);
      callback(err);
    });
  });

}
