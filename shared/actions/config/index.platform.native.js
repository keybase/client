// @flow
import * as Constants from '../../constants/config'
import {NativeModules} from 'react-native'

function readAppVersion () {
  const nativeBridge = NativeModules.KeybaseEngine
  const version = nativeBridge.version
  return {
    payload: {version},
    type: Constants.readAppVersion,
  }
}

export {
  readAppVersion,
}
