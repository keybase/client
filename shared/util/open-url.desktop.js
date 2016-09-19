import {shell} from 'electron'

export default function openURL (url) {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  shell.openExternal(url)
}
