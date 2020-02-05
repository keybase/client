import * as SafeElectron from '../../util/safe-electron.desktop'
import os from 'os'
const {appPath} = KB.electron.app
const {resolve} = KB.path
const {env} = KB.process

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
  if (os.platform() === 'darwin') {
    return resolve(appPath, '..', '..', '..', 'Contents', 'SharedSupport', 'bin', 'keybase')
  } else {
    return null
  }
}
