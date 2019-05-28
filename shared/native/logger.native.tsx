import {NativeModules} from 'react-native'
import {NativeLogDump} from './logger'
import {debounce} from 'lodash-es'

export type RealNativeLog = (tagsAndLogs: Array<Array<string>>) => void
const _log: RealNativeLog = __STORYBOOK__ ? tagsAndLogs => {} : NativeModules.KBNativeLogger.log

// Don't send over the wire immediately. That has horrible performance
const actuallyLog = debounce(() => {
  _log(toSend)
  toSend = []
}, 5 * 1000)

let toSend = []

const log = (tagPrefix: string, toLog: string) => {
  toSend.push([tagPrefix, toLog])
  actuallyLog()
}

const dump: NativeLogDump = __STORYBOOK__
  ? tagPrefix => {
      const p: Promise<Array<string>> = Promise.resolve([])
      return p
    }
  : NativeModules.KBNativeLogger.dump

export {log, dump}
