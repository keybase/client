import * as SafeElectron from './safe-electron.desktop'

const openURL = (url: string | null) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  SafeElectron.getShell().openExternal(url)
}

export default openURL
