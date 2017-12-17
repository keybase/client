// @flow
import {NativeModules} from 'react-native'
import {isStoryBook} from '../constants/platform'
import type {NativeLog, NativeLogDump} from './logger'

const log: NativeLog = isStoryBook ? (tagPrefix, toLog) => {} : NativeModules.KBNativeLogger.log
const dump: NativeLogDump = isStoryBook
  ? tagPrefix => {
      const p: Promise<Array<string>> = Promise.resolve([])
      return p
    }
  : NativeModules.KBNativeLogger.dump

export {log, dump}
