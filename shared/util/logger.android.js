// @flow
import {NativeModules} from 'react-native'

const logger = {
  info: (...args: Array<any>) => NativeModules.FileLogger.info(args.join(',')),
  warn: (...args: Array<any>) => NativeModules.FileLogger.warn(args.join(',')),
  error: (...args: Array<any>) =>
    NativeModules.FileLogger.error(args.join(',')),
}

export default logger
