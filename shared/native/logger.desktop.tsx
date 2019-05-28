import {NativeLog, NativeLogDump} from './logger'

const log: NativeLog = (tagPrefix, toLog) => {
  console.error('not supported on desktop!')
}
const dump: NativeLogDump = tagPrefix => {
  const p: Promise<Array<string>> = Promise.reject(new Error('Not supported on desktop!'))
  return p
}

export {log, dump}
