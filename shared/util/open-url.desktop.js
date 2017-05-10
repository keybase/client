// @flow
import {shell, ipcRenderer} from 'electron'

export default function openURL(url: ?string) {
  if (!url) {
    console.warn('openURL received empty url')
    return
  }
  shell.openExternal(url)
}

export function openURLWithHelper(type: string, params: ?string) {
  ipcRenderer.send('openURL', type, params)
}
