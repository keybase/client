import {NativeLinking} from '../common-adapters'

export default function openURL (url) {
  NativeLinking.openURL(url).catch(err => console.warn('An error occurred', err))
}

