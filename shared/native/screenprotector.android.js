// @flow
import {NativeModules} from 'react-native'

const setSecureFlagSetting = NativeModules.ScreenProtector.setSecureFlagSetting
const getSecureFlagSetting = NativeModules.ScreenProtector.getSecureFlagSetting

export {setSecureFlagSetting, getSecureFlagSetting}
