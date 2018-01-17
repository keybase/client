// @flow
import type {
  AggregateLogger,
  LogLevel,
  Logger,
  LogFn,
  LogLineWithLevel,
  LogLineWithLevelISOTimestamp,
} from './types'
import {isMobile, logFileName} from '../constants/platform'
import {toISOTimestamp} from './types'
import ConsoleLogger from './console-logger'
import TeeLogger from './tee-logger'
import RingLogger from './ring-logger'
import NullLogger from './null-logger'
import NativeLogger from './native-logger'
import DumpPeriodicallyLogger from './dump-periodically-logger'
import {writeLogLinesToFile} from '../util/forward-logs'
import {stat, unlink} from '../util/file'

// Function to flatten arrays and preserve their sort order
// Same as concating all the arrays and calling .sort() but could be faster
// sortFn behaves just like .sort()'s sortFn
function _mergeSortedArraysHelper<A>(sortFn: (a: A, b: A) => number, ...arrays: Array<Array<A>>): Array<A> {
  // TODO make a more effecient version - doing simple thing for now
  return [].concat(...arrays).sort(sortFn)
}

function deleteFileIfOlderThanMs(olderThanMs: number, filepath: string): Promise<void> {
  return stat(filepath)
    .then(({lastModified}) => {
      if (Date.now() - lastModified > olderThanMs) {
        return unlink(filepath)
      }
    })
    .catch(() => {})
}

class AggregateLoggerImpl implements AggregateLogger {
  _error: Logger
  _warn: Logger
  _info: Logger
  _action: Logger
  _debug: Logger
  _record: Logger
  error: LogFn
  warn: LogFn
  info: LogFn
  action: LogFn
  debug: LogFn
  record: LogFn
  _allLoggers: {[key: LogLevel]: Logger}

  constructor({
    error,
    warn,
    info,
    action,
    debug,
    record,
  }: {
    error: Logger,
    warn: Logger,
    info: Logger,
    action: Logger,
    debug: Logger,
    record: Logger,
  }) {
    this._error = error
    this._warn = warn
    this._info = info
    this._action = action
    this._debug = debug
    this._record = record

    this._allLoggers = {
      Error: error,
      Warn: warn,
      Info: info,
      Action: action,
      Debug: debug,
      Record: record,
    }

    this.error = error.log
    this.warn = warn.log
    this.info = info.log
    this.action = action.log
    this.debug = debug.log
    this.record = record.log

    const olderThanMs = 1e3 * 60 * 60 * 24 // 24 hours
    if (!__STORYBOOK__) {
      deleteFileIfOlderThanMs(olderThanMs, logFileName())
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
  debug: new ConsoleLogger('log', 'DEBUG:'),
  error: new ConsoleLogger('error'),
  info: new ConsoleLogger('log'),
  warn: new ConsoleLogger('warn'),
  record: new ConsoleLogger('log'),
})

const prodLoggers = () => ({
  action: isMobile
    ? new NativeLogger()
    : new DumpPeriodicallyLogger(new RingLogger(5000), 10 * 60e3, writeLogLinesToFile, 'Action'),
  debug: new NullLogger(),
  error: isMobile
    ? new NativeLogger()
    : new DumpPeriodicallyLogger(new RingLogger(1000), 1 * 60e3, writeLogLinesToFile, 'Error'),
  info: new RingLogger(1000),
  warn: new RingLogger(1000),
  record: isMobile
    ? new NativeLogger()
    : new DumpPeriodicallyLogger(new RingLogger(5000), 1 * 60e3, writeLogLinesToFile, 'Record'),
})

// Settings
const logSetup = __DEV__ || __STORYBOOK__ ? devLoggers() : prodLoggers()

export default new AggregateLoggerImpl(logSetup)
