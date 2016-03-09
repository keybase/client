import {shell} from 'electron'

export default function openURL (url) {
  shell.openExternal(url)
}
