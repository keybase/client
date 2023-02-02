import type * as Types from './types'
import {Logger} from './logger'

// Present a single logger interface to the outside world, but actually delegate the various methods to different
// loggers / strategies
class AggregateLoggerImpl {
  private _error: Logger
  private _warn: Logger
  private _info: Logger
  private _action: Logger
  private _debug: Logger

  error = (...s: Array<any>) => this._error.log(...s)
  warn = (...s: Array<any>) => this._warn.log(...s)
  info = (...s: Array<any>) => this._info.log(...s)
  action = (...s: Array<any>) => this._action.log(...s)
  debug = (...s: Array<any>) => this._debug.log(...s)

  private allLoggers: Array<Logger>

  constructor() {
    if (__DEV__) {
      this._action = new Logger('Action', 100, 0)
      this._debug = new Logger('Debug', 10000, 1 * 60e3)
      this._error = new Logger('Error', 10000, 1 * 60e3)
      this._info = new Logger('Info', 10000, 0)
      this._warn = new Logger('Warn', 0, 0)
    } else {
      this._action = new Logger('Action', 200, 10 * 60e3)
      this._debug = new Logger('Debug', 0, 0)
      this._error = new Logger('Error', 10000, 1 * 60e3)
      this._info = new Logger('Info', 1000, 1 * 60e3)
      this._warn = new Logger('Warn', 10000, 1 * 60e3)
    }

    this.allLoggers = [this._error, this._warn, this._info, this._action, this._debug]
  }

  dump = async () => {
    const lines = await Promise.all(this.allLoggers.map(l => l.dump()))
    const ret = lines
      .flat()
      .sort(([, tsA], [, tsB]) => tsA - tsB)
      .map(line => {
        const [level, ts, log] = line
        return [level, new Date(ts).toISOString(), log] as Types.LogLineWithLevelISOTimestamp
      })
    return ret
  }

  // flush = async () => {
  //   await Promise.all(this.allLoggers.map(l => l.flush()))
  // }
}

const theOnlyLogger = new AggregateLoggerImpl()
export default theOnlyLogger
