import * as SafeElectron from '../../util/safe-electron.desktop'
import os from 'os'
const {appPath} = KB.electron.app
const {resolve} = KB.path
const {env} = KB.process

// Path to keybase executable (darwin only), null if not available
export function keybaseBinPath() {
  if (os.platform() === 'win32') {
    var guiAppPath = SafeElectron.getApp().getAppPath()
    if (env.LOCALAPPDATA && !guiAppPath) {
      guiAppPath = resolve(env.LOCALAPPDATA, 'Keybase', 'Gui', 'resources', 'app')
    }
    if (!guiAppPath) {
      console.log('No keybase bin path')
      return null
    }
    const kbPath = resolve(guiAppPath, '..', '..', '..')
    console.log(`expected path to keybase binaries is ${kbPath}`)
    return resolve(String(kbPath), 'keybase.exe')
  }
  if (os.platform() === 'darwin') {
    return resolve(appPath, '..', '..', '..', 'Contents', 'SharedSupport', 'bin', 'keybase')
  } else {
    return null
  }
}
