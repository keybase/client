// @flow
import {shell} from 'electron'

const openURL = (url: ?string) => {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  shell.openExternal(url)
}

export default openURL
