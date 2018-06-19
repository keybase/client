// @flow
import {NativeModules} from 'react-native'

const openSMS = (phonenos: Array<string>, body?: string): Promise<any> => {
  const messageUI = NativeModules.MessageUI
  if (!messageUI) {
    const err = new Error('Unable to load native messageUI module')
    console.error(err)
    return Promise.reject(err)
  }
  return messageUI.composeMessage(phonenos, body || '')
}

export default openSMS
