import {NativeModules} from 'react-native'
import {NativeLogDump} from './logger'
import {debounce} from 'lodash-es'
import {isAndroid} from '../constants/platform'

export type RealNativeLog = (tagsAndLogs: Array<Array<string>>) => void
const _log: RealNativeLog = __STORYBOOK__ || isAndroid ? () => {} : NativeModules.KBNativeLogger.log

// Don't send over the wire immediately. That has horrible performance
const actuallyLog = debounce(() => {
  if (isAndroid) {
    // Using console.log on android is ~3x faster.
    for (let i = 0; i < toSend.length; i++) {
      const [tagPrefix, toLog] = toSend[i]
      const formatted = `${tagPrefix}KBNativeLogger: ${toLog}`
      switch (tagPrefix) {
        case 'w':
          console.warn(formatted)
          continue
        case 'e':
          console.error(formatted)
          continue
        default:
          console.log(formatted)
          continue
      }
    }
  } else {
    // iOS is using lumberjack for logging, so keep this for now
    _log(toSend)
  }
  toSend = []
}, 5000)

let toSend: Array<[string, string]> = []

const log = (tagPrefix: string, toLog: string) => {
  toSend.push([tagPrefix, toLog])
  actuallyLog()
}

const dump: NativeLogDump = __STORYBOOK__
  ? () => {
      const p: Promise<Array<string>> = Promise.resolve([])
      return p
    }
  : (...args) => {
      actuallyLog.flush()
      return NativeModules.KBNativeLogger.dump(...args)
    }

const flush = actuallyLog.flush

export {log, dump, flush}
