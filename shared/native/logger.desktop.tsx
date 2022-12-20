import type {NativeLog, NativeLogDump} from './logger'

export const log: NativeLog = () => {
  console.error('not supported on desktop!')
}
export const dump: NativeLogDump = async () => {
  const p: Promise<Array<string>> = Promise.reject(new Error('Not supported on desktop!'))
  return p
}

export const flush = () => {}
