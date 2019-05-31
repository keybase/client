import {toISOTimestamp, Logger, LogLevel, LogLineWithLevelISOTimestamp} from './types'
import {requestIdleCallback} from '../util/idle-callback'

type FileWriterFn = (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void>

// Dumps the inner logger periodically, everything else is forwarded
// At most every `periodInMs` seconds. May be a little less because
// requestIdleCallback is used.
class DumpPeriodicallyLogger implements Logger {
  _innerLogger: Logger
  _periodInMs: number
  _fileWriterFn: FileWriterFn
  _lastTimeoutId: NodeJS.Timer | null = null
  _levelPrefix: LogLevel
  _ok: boolean = true

  constructor(innerLogger: Logger, periodInMs: number, fileWriterFn: FileWriterFn, levelPrefix: LogLevel) {
    this._innerLogger = innerLogger
    this._periodInMs = periodInMs
    this._fileWriterFn = fileWriterFn
    this._levelPrefix = levelPrefix
    this._periodicallyDump()
  }

  log = (...s: Array<any>) => this._innerLogger.log(...s)
  dump = (levelPrefix: LogLevel) => this._innerLogger.dump(levelPrefix)

  _periodicallyDump = () => {
    if (this._ok) {
      return this._innerLogger
        .dump(this._levelPrefix)
        .then(logLines => logLines.map(toISOTimestamp))
        .then(this._fileWriterFn)
        .then(() => {
          this._lastTimeoutId = setTimeout(
            () =>
              requestIdleCallback(
                () => {
                  this._periodicallyDump()
                },
                {timeout: this._periodInMs}
              ),
            this._periodInMs
          )
        })
        .catch(e => {
          console.error('dump-periodically failed', e)
          this._ok = false
        })
    }

    return Promise.reject(new Error('Not ok'))
  }

  flush() {
    this._ok = true
    this._lastTimeoutId && clearTimeout(this._lastTimeoutId)
    return this._innerLogger.flush().then(this._periodicallyDump)
  }
}

export default DumpPeriodicallyLogger
