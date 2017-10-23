// @flow
import type {Logger, LogLevel, LogLineWithLevel} from './types'

type ConsoleLogLevel = 'log' | 'warn' | 'error'
// Use console.level
class ConsoleLogger implements Logger {
  _level: ConsoleLogLevel
  _prefix: string

  constructor(level: ConsoleLogLevel, prefix?: string = '') {
    this._level = level
    this._prefix = prefix
    this.log = console[level].bind(console, prefix)
  }

  // Replaced in constructor
  log = (...s: Array<any>) => {}

  dump(levelPrefix: LogLevel) {
    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve([])
    return p
  }

  flush() {}
}

export default ConsoleLogger
