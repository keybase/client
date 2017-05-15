// @flow
import {NativeLinking} from '../common-adapters/index.native'
import {urlHelper} from './url-helper'

export default function openURL(url: ?string) {
  NativeLinking.openURL(url).catch(err => console.warn('An error occurred', err))
}

export function openURLWithHelper(type: string, params: ?string) {
  const link = urlHelper(type, params)
  return link && openURL(link)
}
