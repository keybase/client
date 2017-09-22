// @flow
import {NativeClipboard} from '../common-adapters/index.native'

export function copyToClipboard(data: string) {
  NativeClipboard.setString(data)
}
