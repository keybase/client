// @flow
import type {
  AggregateLogger,
  LogLevel,
  Logger,
  LogFn,
  LogLineWithLevel,
  LogLineWithLevelISOTimestamp,
} from './types'
import {isMobile} from '../constants/platform'
import {toISOTimestamp} from './types'
import ConsoleLogger from './console-logger'
import TeeLogger from './tee-logger'
import RingLogger from './ring-logger'
import NativeLogger from './native-logger'
import NullLogger from './null-logger'
import DumpPeriodicallyLogger from './dump-periodically-logger'
import {writeLogLinesToFile, deleteOldLog} from '../util/forward-logs'

// Function to flatten arrays and preserve their sort order
// Same as concatenating all the arrays and calling .sort() but could be faster
// sortFn behaves just like .sort()'s sortFn
function _mergeSortedArraysHelper<A>(sortFn: (a: A, b: A) => number, ...arrays: Array<Array<A>>): Array<A> {
  // TODO make a more efficient version - doing simple thing for now
  return [].concat(...arrays).sort(sortFn)
}

class AggregateLoggerImpl implements AggregateLogger {
  error: LogFn
  warn: LogFn
  info: LogFn
  action: LogFn
  debug: LogFn
  _allLoggers: {[key: LogLevel]: Logger}

  constructor(o: {error: Logger, warn: Logger, info: Logger, action: Logger, debug: Logger}) {
    this._allLoggers = {
      Error: o.error,
      Warn: o.warn,
      Info: o.info,
      Action: o.action,
      Debug: o.debug,
    }

    this.error = o.error.log
    this.warn = o.warn.log
    this.info = o.info.log
    this.action = o.action.log
    this.debug = o.debug.log

    const olderThanMs = 1e3 * 60 * 60 * 24 // 24 hours
    if (!__STORYBOOK__) {
      deleteOldLog(olderThanMs)
    }
  }

  dump(filter?: Array<LogLevel>) {
    const allKeys: Array<LogLevel> = Object.keys(this._allLoggers)
    const filterKeys = filter || allKeys
    const logDumpPromises = filterKeys.map((level: LogLevel) => this._allLoggers[level].dump(level))
    const p: Promise<Array<LogLineWithLevelISOTimestamp>> = Promise.all(logDumpPromises).then(
      (logsToDump: Array<Array<LogLineWithLevel>>): Array<LogLineWithLevelISOTimestamp> =>
        _mergeSortedArraysHelper(
          ([, tsA]: LogLineWithLevel, [, tsB]: LogLineWithLevel) => tsA - tsB,
          ...logsToDump
        ).map(toISOTimestamp)
    )

    return p
  }

  flush() {
    const allKeys: Array<LogLevel> = Object.keys(this._allLoggers)
    allKeys.map(level => this._allLoggers[level].flush())
    const p: Promise<void> = Promise.all(allKeys).then(() => {})
    return p
  }
}

const devLoggers = () => ({
  action: new TeeLogger(new RingLogger(100), new ConsoleLogger('log', 'Dispatching Action')),
  debug: new TeeLogger(
    isMobile
      ? new NativeLogger('e')
      : new DumpPeriodicallyLogger(new RingLogger(10000), 1 * 60e3, writeLogLinesToFile, 'Info'),
    new ConsoleLogger('log', 'DEBUG:')
  ),
  error: new TeeLogger(
    isMobile
      ? new NativeLogger('e')
      : new DumpPeriodicallyLogger(new RingLogger(10000), 1 * 60e3, writeLogLinesToFile, 'Error'),
    new ConsoleLogger('error')
  ),
  info: new TeeLogger(new RingLogger(10000), new ConsoleLogger('log')),
  warn: new ConsoleLogger('warn'),
})

const prodLoggers = () => ({
  action: isMobile
    ? new RingLogger(200)
    : new DumpPeriodicallyLogger(new RingLogger(200), 10 * 60e3, writeLogLinesToFile, 'Action'),
  debug: new NullLogger(),
  error: isMobile
    ? new NativeLogger('e')
    : new DumpPeriodicallyLogger(new RingLogger(10000), 1 * 60e3, writeLogLinesToFile, 'Error'),
  info: isMobile
    ? new NativeLogger('i')
    : new DumpPeriodicallyLogger(new RingLogger(1000), 1 * 60e3, writeLogLinesToFile, 'Info'),
  warn: isMobile
    ? new NativeLogger('w')
    : new DumpPeriodicallyLogger(new RingLogger(10000), 1 * 60e3, writeLogLinesToFile, 'Warn'),
})

// Settings
const logSetup = __DEV__ || __STORYBOOK__ ? devLoggers() : prodLoggers()

const theOnlyLogger = new AggregateLoggerImpl(logSetup)

if (!isMobile && typeof global !== 'undefined') {
  // So we can easily grab this from the main renderer
  global.globalLogger = theOnlyLogger
}

export default theOnlyLogger
