// @flow
import {NativeModules} from 'react-native'
import {isStoryBook} from '../constants/platform'
export default (isStoryBook ? () => {} : NativeModules.KBLogSend.logSend)
