import {NativeModules} from 'react-native'

const m = __STORYBOOK__
  ? {getSecureFlagSetting: () => {}, setSecureFlagSetting: () => {}}
  : NativeModules.ScreenProtector

const setSecureFlagSetting = m.setSecureFlagSetting
const getSecureFlagSetting = m.getSecureFlagSetting

export {setSecureFlagSetting, getSecureFlagSetting}
