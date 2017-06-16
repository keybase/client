// @flow
import {setupLogger} from './periodic-logger'

const MAX = 10000
const androidConsoleLogger = setupLogger('androidConsoleLog', MAX, false, null, 0, false)

const logger = {
  info: (...args: Array<any>) => androidConsoleLogger.log(args.join(',')),
  warn: (...args: Array<any>) => androidConsoleLogger.warn(args.join(',')),
  error: (...args: Array<any>) => androidConsoleLogger.error(args.join(',')),
}

export default logger
