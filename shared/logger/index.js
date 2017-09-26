// @flow
import type {AggregateLogger, LogLevels, Logger, LogFn, LogLineWithLevel} from './types'

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
  _allLoggers: {[key: LogLevels]: Logger}

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

  dump(filter?: Array<LogLevels>) {
    // $FlowIssue with Object.keys just returning Array<string>
    const allKeys: Array<LogLevels> = Object.keys(this._allLoggers)
    const filterKeys = filter || allKeys
    const logDumpPromises = filterKeys.map((level: LogLevels) => this._allLoggers[level].dump(level))
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
    const allKeys: Array<LogLevels> = Object.keys(this._allLoggers)
    allKeys.forEach(level => this._allLoggers[level].flush())
  }
}

export default AggregateLoggerImpl
