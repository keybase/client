// @flow
import type {NativeLog, NativeLogDump} from './logger'

// TODO
const log: NativeLog = (tagPrefix, toLog) => {}
const dump: NativeLogDump = tagPrefix => {
  const p: Promise<Array<string>> = Promise.resolve([])
  return p
}

export {log, dump}
