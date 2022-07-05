import {Logger, LogLevel} from './types'

// Log to multiple loggers, only dump from the first one
class TeeLogger implements Logger {
  _loggerToDumpFrom: Logger
  _otherLoggers: Array<Logger>

  constructor(loggerToDumpFrom: Logger, ...otherLoggers: Array<Logger>) {
    this._loggerToDumpFrom = loggerToDumpFrom
    this._otherLoggers = otherLoggers
  }

  log = (...args: Array<any>) => {
    this._loggerToDumpFrom.log(...args)
    this._otherLoggers.map(l => l.log(...args))
  }

  dump = (levelPrefix: LogLevel) => {
    return this._loggerToDumpFrom.dump(levelPrefix)
  }

  flush = () => {
    return this._loggerToDumpFrom.flush()
  }
}

export default TeeLogger
