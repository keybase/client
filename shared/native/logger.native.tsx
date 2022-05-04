import {NativeModules} from '../util/native-modules.native'
import type {NativeLogDump} from './logger'
import debounce from 'lodash/debounce'
import {isAndroid} from '../constants/platform'

type TagAndLog = Array<[string, string]>

export type RealNativeLog = (tagsAndLogs: TagAndLog) => void
const _log: RealNativeLog =
  __STORYBOOK__ || isAndroid
    ? (_tagsAndLogs: TagAndLog) => {}
    : NativeModules.KBNativeLogger?.log ?? (() => {})

// Don't send over the wire immediately. That has horrible performance
const actuallyLog = debounce(() => {
  if (isAndroid) {
    // Using console.log on android is ~3x faster.
    for (const ts of toSend) {
      const [tagPrefix, toLog] = ts
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

let toSend: TagAndLog = []

const log = (tagPrefix: string, toLog: string) => {
  toSend.push([tagPrefix, toLog])
  actuallyLog()
}

const dump: NativeLogDump = async (prefix: string) => {
  actuallyLog.flush()
  return NativeModules.KBNativeLogger?.dump(prefix) ?? Promise.resolve([])
}

const flush = actuallyLog.flush

export {log, dump, flush}
