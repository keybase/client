import * as SafeElectron from '../../util/safe-electron.desktop'
import os from 'os'
const {appPath} = KB.electron.app
const {resolve} = KB.path
const {env} = KB.process

// Path to keybase executable, null if not available
export function keybaseBinPath() {
  const kbCli = env.KEYBASE_BIN_PATH

  if (os.platform() === 'win32') {
    if (kbCli) {
      return resolve(String(kbCli), 'keybase.exe')
    }
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

  // Platform is NOT Windows
  if (kbCli) {
    return resolve(String(kbCli), 'keybase')
  } else if (os.platform() === 'darwin') {
    return resolve(appPath, '..', '..', '..', 'Contents', 'SharedSupport', 'bin', 'keybase')
  } else {
    return null
  }
}
