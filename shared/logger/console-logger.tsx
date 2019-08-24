import {Logger, LogLineWithLevel} from './types'

type ConsoleLogLevel = 'log' | 'warn' | 'error'
// Use console.level
class ConsoleLogger implements Logger {
  _level: ConsoleLogLevel
  _prefix: string

  constructor(level: ConsoleLogLevel, prefix: string = '') {
    this._level = level
    this._prefix = prefix
    this.log = console[level].bind(console, prefix)
  }

  // Replaced in constructor
  log = () => {}

  dump() {
    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve([])
    return p
  }

  flush() {
    const p: Promise<void> = Promise.resolve()
    return p
  }
}

export default ConsoleLogger
