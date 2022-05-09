import * as remote from '@electron/remote'
import type {Shell} from 'electron'

const openURL = (url: string | null) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  const shell = remote.shell as Shell
  shell
    .openExternal(url)
    .then(() => {})
    .catch(() => {})
}

export default openURL
