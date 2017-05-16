// @flow

import {setupLogger} from './periodic-logger'

const MAX = 10000
const logger = setupLogger('consoleLog', MAX, false, null, 0, false)

export default {
  error: (...args: Array<any>) => logger.error(...args),
  info: (...args: Array<any>) => logger.log(...args),
  warn: (...args: Array<any>) => logger.warn(...args),
}
