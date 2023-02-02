import type * as Types from './types'
// TODO move native logger here and simplify
class NativeLogger {
  constructor(_logLevel: Types.LogLevel, _ringSize: number, _writePeriod: number) {}
  log = (..._s: Array<any>) => {}
  dump = async () => {
    await Promise.resolve()
    return
  }
}
export default NativeLogger
