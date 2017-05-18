// @flow
import {app} from 'electron'
import getenv from 'getenv'
import path from 'path'
import os from 'os'

function appPath () {
  // For testing when running manually via npm start
  // return '/Applications/Keybase.app/Contents/Resources/app/'
  // For testing running from DMG
  // return '/Volumes/Keybase/Keybase.app/Contents/Resources/app/'
  const appPath = getenv.string('KEYBASE_GET_APP_PATH', '')
  if (appPath !== '') {
    return appPath
  }
  return app.getAppPath()
}

// Path to bundle directory, e.g. /Applications/Keybase.app (darwin only)
export function appBundlePath() {
  if (os.platform() !== 'darwin') return null
  return path.resolve(appPath(), '..', '..', '..')
}

// Path to resources directory (darwin only), null if not available
export function appResourcesPath() {
  if (os.platform() !== 'darwin') return null
  return path.resolve(appPath(), '..')
}

// Path to installer executable (darwin only), null if not available
export function appInstallerPath() {
  if (os.platform() !== 'darwin') return null
  const resourcesPath = appResourcesPath()
  if (resourcesPath === null) return null
  return path.resolve(resourcesPath, 'KeybaseInstaller.app', 'Contents', 'MacOS', 'Keybase')
}

// Path to keybase executable (darwin only), null if not available
export function keybaseBinPath() {
  if (os.platform() === 'win32') {
      var kbPath = app.getPath('appData').replace('Roaming', 'Local')
      if (kbPath === null) kbPath = process.env.LOCALAPPDATA
      return path.resolve(kbPath, 'Keybase', 'keybase.exe')
  }
  if (os.platform() !== 'darwin') return null
  const bundlePath = appBundlePath()
  if (bundlePath === null) return null
  return path.resolve(bundlePath, 'Contents', 'SharedSupport', 'bin', 'keybase')
}
