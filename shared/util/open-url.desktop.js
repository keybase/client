// @flow
import {shell} from 'electron'

export default function openURL (url: ?string) {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  shell.openExternal(url)
}
