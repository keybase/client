// @flow

import {setupLogger} from './periodic-logger'

const MAX = 10000
const nativeConsoleLogger = setupLogger('nativeConsoleLog', MAX, false, null, 0, false)

export default {
  info: (...args: Array<any>) => nativeConsoleLogger.log(...args),
  warn: (...args: Array<any>) => nativeConsoleLogger.warn(...args),
  error: (...args: Array<any>) => nativeConsoleLogger.error(...args),
}
