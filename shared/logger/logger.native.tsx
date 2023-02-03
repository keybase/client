// import type * as Types from '.'
// TODO move native logger here and simplify
class NativeLogger {
  // constructor(_logLevel: Types.LogLevel, _ringSize: number, _writePeriod: number) {}
  log = (..._s: Array<any>) => {}
  dump = async () => {
    return Promise.resolve([])
  }
}
export default NativeLogger

// import type {NativeLogDump} from './logger'
// import debounce from 'lodash/debounce'
// import {isAndroid} from '../constants/platform'
// import {iosLog, logDump} from 'react-native-kb'

// type TagAndLog = Array<[string, string]>

// // Don't send over the wire immediately. That has horrible performance
// const actuallyLog = debounce(() => {
//   if (isAndroid) {
//     // Using console.log on android is ~3x faster.
//     for (const ts of toSend) {
//       const [tagPrefix, toLog] = ts
//       const formatted = `${tagPrefix}NativeLogger: ${toLog}`
//       switch (tagPrefix) {
//         case 'w':
//           console.warn(formatted)
//           continue
//         case 'e':
//           console.error(formatted)
//           continue
//         default:
//           console.log(formatted)
//           continue
//       }
//     }
//   } else {
//     // iOS is using lumberjack for logging, so keep this for now
//     iosLog(toSend)
//   }
//   toSend = []
// }, 5000)

// let toSend: TagAndLog = []

// const log = (tagPrefix: string, toLog: string) => {
//   toSend.push([tagPrefix, toLog])
//   actuallyLog()
// }

// const dump: NativeLogDump = async (prefix: string) => {
//   actuallyLog.flush()
//   return await logDump(prefix)
// }

// const flush = actuallyLog.flush

// export {log, dump, flush}
