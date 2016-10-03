// @flow
import * as Constants from '../../constants/config'
import {NativeModules} from 'react-native'

function readAppVersion () {
  const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine
  const version = nativeBridge.version
  return {
    type: Constants.readAppVersion,
    payload: {version},
  }
}

export {
  readAppVersion,
}
