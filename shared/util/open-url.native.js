// @flow
import {NativeLinking} from '../common-adapters/index.native'

export default function openURL (url: ?string) {
  NativeLinking.openURL(url).catch(err => console.warn('An error occurred', err))
}
