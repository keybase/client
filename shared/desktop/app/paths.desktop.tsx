import os from 'os'
import path from 'path'
import KB2 from '../../util/electron.desktop'
import {app} from 'electron'
const {env} = KB2.constants

// Path to keybase executable (darwin only), null if not available
export function keybaseBinPath() {
  if (os.platform() === 'win32') {
    let guiAppPath = app.getAppPath()
    if (env.LOCALAPPDATA && !guiAppPath) {
      guiAppPath = path.resolve(env.LOCALAPPDATA, 'Keybase', 'Gui', 'resources', 'app')
    }
    if (!guiAppPath) {
      console.log('No keybase bin path')
      return null
    }
    const kbPath = path.resolve(guiAppPath, '..', '..', '..')
    console.log(`expected path to keybase binaries is ${kbPath}`)
    return path.resolve(String(kbPath), 'keybase.exe')
  }
  if (os.platform() === 'darwin') {
    return path.resolve(app.getAppPath(), '..', '..', '..', 'Contents', 'SharedSupport', 'bin', 'keybase')
  } else {
    return null
  }
}
