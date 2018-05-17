// @flow
import * as SafeElectron from './safe-electron.desktop'

const openURL = (url: ?string) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  SafeElectron.getShell().openExternal(url)
}

export default openURL
