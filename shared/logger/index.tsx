import * as T from '@/constants/types'
import Logger from './ring-logger'
import noop from 'lodash/noop'
import type {hasEngine as HasEngineType} from '../engine/require'
import {isMobile} from '@/constants/platform'
import {requestIdleCallback} from '@/util/idle-callback'

export type Timestamp = number
export type ISOTimestamp = string
export type LogLevel = 'Error' | 'Warn' | 'Info' | 'Action' | 'Debug'
export type LogLine = [Timestamp, string]
export type LogLineWithLevel = [LogLevel, Timestamp, string]
export type LogLineWithLevelISOTimestamp = [LogLevel, ISOTimestamp, string]
export type LogFn = (...s: Array<any>) => void

export type Loggers = {
  error: Logger
  warn: Logger
  info: Logger
  action: Logger
  debug: Logger
}

const localLog = isMobile ? (__DEV__ ? console.log.bind(console) : noop) : console.log.bind(console)
const localWarn = console.warn.bind(console)
const localError = console.error.bind(console)

// inject for convenience
if (__DEV__) {
  globalThis.DEBUGLog = console.log
  globalThis.DEBUGWarn = console.warn
  globalThis.DEBUGError = console.error
  globalThis.DEBUGInfo = console.info
}

// Present a single logger interface to the outside world, but actually delegate the various methods to different
// loggers / strategies
class AggregateLoggerImpl {
  private _error: Logger
  private _warn: Logger
  private _info: Logger
  private _action: Logger
  private _debug: Logger

  error = (...s: Array<unknown>) => this._error.log(...s)
  warn = (...s: Array<unknown>) => this._warn.log(...s)
  info = (...s: Array<unknown>) => this._info.log(...s)
  action = (...s: Array<unknown>) => this._action.log(...s)
  debug = (...s: Array<unknown>) => this._debug.log(...s)

  localError = (...s: Array<unknown>) => localError(...s)
  localWarn = (...s: Array<unknown>) => localWarn(...s)
  localLog = (...s: Array<unknown>) => localLog(...s)

  private allLoggers: Array<Logger>
  // loggers that we dump periodically
  private periodLoggers: Array<Logger>
  private periodTime = 1 * 60e3
  private timerID: undefined | ReturnType<typeof setTimeout>

  private resetPeriodic = () => {
    this.timerID && clearTimeout(this.timerID)
    // we wait, then want a good opportunity
    this.timerID = setTimeout(() => {
      requestIdleCallback(
        () => {
          this.dump(true)
            .then(() => {})
            .catch(() => {})
        },
        {timeout: this.periodTime}
      )
    }, this.periodTime)
  }

  constructor() {
    if (__DEV__) {
      this._action = new Logger('Action', 100)
      this._debug = new Logger('Debug', 10000)
      this._error = new Logger('Error', 10000)
      this._info = new Logger('Info', 10000)
      this._warn = new Logger('Warn', 0)
      this.periodLoggers = [this._debug, this._error]
    } else {
      this._action = new Logger('Action', 200)
      this._debug = new Logger('Debug', 0)
      this._error = new Logger('Error', 10000)
      this._info = new Logger('Info', 1000)
      this._warn = new Logger('Warn', 10000)
      this.periodLoggers = [this._action, this._error, this._info, this._warn]
    }

    this.allLoggers = [this._action, this._debug, this._error, this._info, this._warn]
    this.resetPeriodic()
  }

  dump = async (periodic: boolean = false) => {
    const loggers = periodic ? this.periodLoggers : this.allLoggers
    const lines = loggers.map(l => l.dump())
    const sortedLogs = lines
      .flat()
      .sort(([, tsA], [, tsB]) => tsA - tsB)
      .map(line => {
        const [level, ts, log] = line
        return [level, new Date(ts).toISOString(), log] as LogLineWithLevelISOTimestamp
      })
    await this.sendLogsToService(sortedLogs)
  }

  sendLogsToService = async (lines: Array<LogLineWithLevelISOTimestamp>) => {
    if (!isMobile) {
      // don't want main node thread making these calls
      try {
        const {hasEngine} = require('../engine/require') as {hasEngine: typeof HasEngineType}
        if (!hasEngine()) {
          return await Promise.resolve()
        }
      } catch {
        return await Promise.resolve()
      }
    }

    const send = lines.length
      ? T.RPCGen.configAppendGUILogsRpcPromise({
          content: lines.join('\n') + '\n',
        })
      : Promise.resolve()
    await send
  }
}

const theOnlyLogger = new AggregateLoggerImpl()
export default theOnlyLogger
