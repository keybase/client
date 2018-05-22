// @flow
import {NativeClipboard} from '../common-adapters/mobile.native'

export function copyToClipboard(data: string) {
  NativeClipboard.setString(data)
}
