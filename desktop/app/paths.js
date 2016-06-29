import {app} from 'electron'
import path from 'path'
import os from 'os'

function appPath () {
  // For testing when running manually via npm start
  // return '/Applications/Keybase.app/Contents/Resources/app/'
  // For testing running from DMG
  // return '/Volumes/Keybase/Keybase.app/Contents/Resources/app/'
  return app.getAppPath()
}

// Path to bundle directory, e.g. /Applications/Keybase.app (darwin only)
export function appBundlePath () {
  if (os.platform() !== 'darwin') return ''
  return path.resolve(appPath(), '..', '..', '..')
}

// Path to resources directory (darwin only), '' if not available
export function appResourcesPath () {
  if (os.platform() !== 'darwin') return ''
  return path.resolve(appPath(), '..')
}

// Path to installer executable (darwin only), '' if not available
export function appInstallerPath () {
  if (os.platform() !== 'darwin') return ''
  const resourcesPath = appResourcesPath()
  if (resourcesPath === '') return ''
  return path.resolve(resourcesPath, 'KeybaseInstaller.app', 'Contents', 'MacOS', 'Keybase')
}

// Path to keybase executable (darwin only), '' if not available
export function keybaseBinPath () {
  if (os.platform() !== 'darwin') return ''
  const bundlePath = appBundlePath()
  if (bundlePath === '') return ''
  return path.resolve(bundlePath, 'Contents', 'SharedSupport', 'bin', 'keybase')
}
