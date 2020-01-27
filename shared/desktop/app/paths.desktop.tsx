import * as SafeElectron from '../../util/safe-electron.desktop'

function appPath() {
  // For testing when running manually via npm start
  // return '/Applications/Keybase.app/Contents/Resources/app/'
  // For testing running from DMG
  // return '/Volumes/Keybase/Keybase.app/Contents/Resources/app/'
  const appPath = KB.__process.env['KEYBASE_GET_APP_PATH'] || ''
  if (appPath !== '') {
    return appPath
  }
  return SafeElectron.getApp().getAppPath()
}

// Path to bundle directory, e.g. /Applications/Keybase.app (darwin only)
export function appBundlePath() {
  if (KB.__os.platform() !== 'darwin') return null
  return KB.__path.resolve(appPath(), '..', '..', '..')
}

// Path to resources directory (darwin only), null if not available
export function appResourcesPath() {
  if (KB.__os.platform() !== 'darwin') return null
  return KB.__path.resolve(appPath(), '..')
}

// Path to installer executable (darwin only), null if not available
export function appInstallerPath() {
  if (KB.__os.platform() !== 'darwin') return null
  const resourcesPath = appResourcesPath()
  if (resourcesPath === null) return null
  return KB.__path.resolve(resourcesPath, 'KeybaseInstaller.app', 'Contents', 'MacOS', 'Keybase')
}

// Path to keybase executable (darwin only), null if not available
export function keybaseBinPath() {
  if (KB.__os.platform() === 'win32') {
    var kbPath = SafeElectron.getApp()
      .getPath('appData')
      .replace('Roaming', 'Local')
    if (!kbPath) {
      kbPath = KB.__process.env.LOCALAPPDATA || ''
    }
    if (!kbPath) {
      console.log('No keybase bin path')
      return null
    }
    return KB.__path.resolve(String(kbPath), 'Keybase', 'keybase.exe')
  }
  if (KB.__os.platform() !== 'darwin') return null
  const bundlePath = appBundlePath()
  if (bundlePath === null) return null
  return KB.__path.resolve(bundlePath, 'Contents', 'SharedSupport', 'bin', 'keybase')
}
