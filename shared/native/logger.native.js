// @flow
import {NativeModules} from 'react-native'
import type {NativeLog, NativeLogDump} from './logger'

const log: NativeLog = __STORYBOOK__ ? (tagPrefix, toLog) => {} : NativeModules.KBNativeLogger.log
const dump: NativeLogDump = __STORYBOOK__
  ? tagPrefix => {
      const p: Promise<Array<string>> = Promise.resolve([])
      return p
    }
  : NativeModules.KBNativeLogger.dump

export {log, dump}
