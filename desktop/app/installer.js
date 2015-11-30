import {app} from 'electron';
import nslog from 'nslog';
import {exec} from 'child_process';
import path from 'path';
import fs from 'fs';

export default (callback) => {

  const appPath = app.getAppPath()
  const resourcesPath = path.resolve(appPath, "..")
  const servicePath = path.resolve(appPath, "..", "..", "SharedSupport", "bin")
  const installerExec = path.resolve(resourcesPath, "Installer.app", "Contents", "MacOS", "Keybase")

  fs.access(installerExec, fs.X_OK , function (err) {
    if (err) {
      // Installer is not available
      callback(null);
      return
    }

    var cmd = [installerExec, "--service-path="+servicePath, "--run-mode=prod"].join(" ");
    exec(cmd, function(err, stdout, stderr) {
      nslog("Installer: ", err, stdout, stderr);
      callback(err);
    });
  });

}
