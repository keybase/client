import {NativeModules} from '../util/native-modules.native'
export default __STORYBOOK__ ? () => Promise.resolve('') : NativeModules.LogSend.logSend
