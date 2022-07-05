import * as Electron from 'electron'

const openURL = (url: string | null) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  Electron.remote.shell.openExternal(url)
}

export default openURL
