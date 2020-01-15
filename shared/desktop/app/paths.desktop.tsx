import * as SafeElectron from '../../util/safe-electron.desktop'
import os from 'os'
const {getAppPath} = KB.electron.app
const {resolve} = KB.path
const {env} = KB.process

function appPath() {
  // For testing when running manually via npm start
  // return '/Applications/Keybase.app/Contents/Resources/app/'
  // For testing running from DMG
  // return '/Volumes/Keybase/Keybase.app/Contents/Resources/app/'
  const ap = env['KEYBASE_GET_APP_PATH'] ?? ''
  return ap ?? getAppPath()
}

// Path to bundle directory, e.g. /Applications/Keybase.app (darwin only)
export function appBundlePath() {
  if (os.platform() !== 'darwin') return null
  return resolve(appPath(), '..', '..', '..')
}

// Path to resources directory (darwin only), null if not available
export function appResourcesPath() {
  if (os.platform() !== 'darwin') return null
  return resolve(appPath(), '..')
}

// Path to installer executable (darwin only), null if not available
export function appInstallerPath() {
  if (os.platform() !== 'darwin') return null
  const resourcesPath = appResourcesPath()
  if (resourcesPath === null) return null
  return resolve(resourcesPath, 'KeybaseInstaller.app', 'Contents', 'MacOS', 'Keybase')
}

// Path to keybase executable (darwin only), null if not available
export function keybaseBinPath() {
  if (os.platform() === 'win32') {
    var kbPath = SafeElectron.getApp()
      .getPath('appData')
      .replace('Roaming', 'Local')
    if (!kbPath) {
      kbPath = env.LOCALAPPDATA || ''
    }
    if (!kbPath) {
      console.log('No keybase bin path')
      return null
    }
    return resolve(String(kbPath), 'Keybase', 'keybase.exe')
  }
  if (os.platform() !== 'darwin') return null
  const bundlePath = appBundlePath()
  if (bundlePath === null) return null
  return resolve(bundlePath, 'Contents', 'SharedSupport', 'bin', 'keybase')
}
