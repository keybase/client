import * as remote from '@electron/remote'

const openURL = (url: string | null) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  remote.shell
    .openExternal(url)
    .then(() => {})
    .catch(() => {})
}

export default openURL
