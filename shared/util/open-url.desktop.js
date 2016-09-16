import {shell} from 'electron'

export default function openURL (url) {
  console.log('in openURL, url is ', url)
  shell.openExternal(url)
}
