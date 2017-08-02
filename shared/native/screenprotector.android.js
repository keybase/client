// @flow
import {NativeModules} from 'react-native'
import {isStoryBook} from '../constants/platform'

const m = isStoryBook
  ? {setSecureFlagSetting: () => {}, getSecureFlagSetting: () => {}}
  : NativeModules.ScreenProtector

const setSecureFlagSetting = m.setSecureFlagSetting
const getSecureFlagSetting = m.getSecureFlagSetting

export {setSecureFlagSetting, getSecureFlagSetting}
