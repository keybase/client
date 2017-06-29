// @flow
// this MUST not include common-adapters cause it causes circular refs. TODO text shouldn't even have  url helper like this. it should
// be some wrapper
import {Linking} from 'react-native'
import {urlHelper} from './url-helper'

export default function openURL(url: ?string) {
  if (url) {
    Linking.openURL(url).catch(err => console.warn('An error occurred', err))
  } else {
    console.log('Skipping null url click')
  }
}

export function openURLWithHelper(type: string, params: ?string) {
  const link = urlHelper(type, params)
  return link && openURL(link)
}
