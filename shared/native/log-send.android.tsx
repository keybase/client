import {NativeModules} from 'react-native'
export default (__STORYBOOK__ ? () => {} : NativeModules.KBLogSend.logSend)
