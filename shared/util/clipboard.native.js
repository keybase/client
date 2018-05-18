// @flow
import {NativeClipboard} from '../common-adapters/native'

export function copyToClipboard(data: string) {
  NativeClipboard.setString(data)
}
