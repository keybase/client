// @flow

import {setupLogger} from './periodic-logger'

const MAX = 10000
const iosConsoleLogger = setupLogger('iosConsoleLog', MAX, false, null, 0, false)

export default {
  info: (...args: Array<any>) => iosConsoleLogger.log(...args),
  warn: (...args: Array<any>) => iosConsoleLogger.warn(...args),
  error: (...args: Array<any>) => iosConsoleLogger.error(...args),
}
