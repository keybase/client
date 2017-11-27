// @flow
import type {AggregateLogger, LogLevel, Logger, LogFn, LogLineWithLevel} from './types'
import ConsoleLogger from './console-logger'
import TeeLogger from './tee-logger'
import RingLogger from './ring-logger'
import NullLogger from './null-logger'
import DumpPeriodicallyLogger from './dump-periodically-logger'
import {writeLogLinesToFile} from '../util/forward-logs'

// Function to flatten arrays and preserve their sort order
// Same as concating all the arrays and calling .sort() but could be faster
// sortFn behaves just like .sort()'s sortFn
function _mergeSortedArraysHelper<A>(sortFn: (a: A, b: A) => number, ...arrays: Array<Array<A>>): Array<A> {
  // TODO make a more effecient version - doing simple thing for now
  return [].concat(...arrays).sort(sortFn)
}

class AggregateLoggerImpl implements AggregateLogger {
  _error: Logger
  _warn: Logger
  _info: Logger
  _action: Logger
  _debug: Logger
  error: LogFn
  warn: LogFn
  info: LogFn
  action: LogFn
  debug: LogFn
  _allLoggers: {[key: LogLevel]: Logger}

  constructor({
    error,
    warn,
    info,
    action,
    debug,
  }: {
    error: Logger,
    warn: Logger,
    info: Logger,
    action: Logger,
    debug: Logger,
  }) {
    this._error = error
    this._warn = warn
    this._info = info
    this._action = action
    this._debug = debug

    this._allLoggers = {
      Error: error,
      Warn: warn,
      Info: info,
      Action: action,
      Debug: debug,
    }

    this.error = error.log
    this.warn = warn.log
    this.info = info.log
    this.action = action.log
    this.debug = debug.log
  }

  dump(filter?: Array<LogLevel>) {
    // $FlowIssue with Object.keys just returning Array<string>
    const allKeys: Array<LogLevel> = Object.keys(this._allLoggers)
    const filterKeys = filter || allKeys
    const logDumpPromises = filterKeys.map((level: LogLevel) => this._allLoggers[level].dump(level))
    const p: Promise<Array<LogLineWithLevel>> = Promise.all(
      logDumpPromises
    ).then((logsToDump: Array<Array<LogLineWithLevel>>): Array<LogLineWithLevel> =>
      _mergeSortedArraysHelper(
        ([, tsA]: LogLineWithLevel, [, tsB]: LogLineWithLevel) => tsA - tsB,
        ...logsToDump
      )
    )

    return p
  }

  flush() {
    // $FlowIssue with Object.keys just returning Array<string>
    const allKeys: Array<LogLevel> = Object.keys(this._allLoggers)
    allKeys.map(level => this._allLoggers[level].flush())
    const p: Promise<void> = Promise.all(allKeys).then(() => {})
    return p
  }
}

// Settings
const logSetup = __DEV__
  ? {
      error: new ConsoleLogger('error'),
      warn: new ConsoleLogger('warn'),
      info: new ConsoleLogger('log'),
      action: new TeeLogger(new RingLogger(100), new ConsoleLogger('log', 'Dispatching Action')),
      debug: new ConsoleLogger('log', 'DEBUG:'),
    }
  : {
      error: new DumpPeriodicallyLogger(new RingLogger(1000), 1 * 60e3, writeLogLinesToFile, 'Error'),
      warn: new RingLogger(1000),
      info: new NullLogger(),
      action: new DumpPeriodicallyLogger(new RingLogger(5000), 10 * 60e3, writeLogLinesToFile, 'Action'),
      debug: new NullLogger(),
    }

export default new AggregateLoggerImpl(logSetup)
