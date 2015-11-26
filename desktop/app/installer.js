export default (callback) => {
  const app = require('electron').app;
  const nslog = require('nslog');
  const exec = require('child_process').exec;
  const path = require("path");
  const fs = require('fs');

  // const exePath = app.getPath("exe")
  // const bundle = path.resolve(appPath, "..", "..")
  // nslog("exePath = ", exePath)
  // nslog("bundle = ", bundle)

  const appPath = app.getAppPath()
  const resourcesPath = path.resolve(appPath, "..")
  const servicePath = path.resolve(appPath, "..", "..", "SharedSupport", "bin")
  const installerExec = path.resolve(resourcesPath, "Installer.app", "Contents", "MacOS", "Keybase")

  // nslog("appPath = ", appPath)
  // nslog("resourcesPath = ", resourcesPath)
  // nslog("servicePath = ", servicePath)
  // nslog("installerExec = ", installerExec)

  fs.access(installerExec, fs.X_OK , function (err) {
    if (err) {
      // Installer is not available
      callback(null)
      return
    }

    var cmd = [installerExec, "--service-path="+servicePath, "--run-mode=prod"].join(" ")
    exec(cmd, function(err, stdout, stderr) {
      nslog("Installer: ", err, stdout, stderr)
      callback(err)
    })
  })
}
