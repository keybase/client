import type * as Types from './types'
import {toStringForLog} from '../util/string'
import {writeLogLinesToFile} from '../util/forward-logs'

const levelToFunction = {
  Action: 'log',
  Debug: 'log',
  Error: 'error',
  Info: 'info',
  Warn: 'warn',
} as const

// Simple in memory ring Logger that dumps itself periodically
class RingAndPeriodLogger {
  private _ringSize: number
  private _currentWriteIdx: number = 0
  private _ringBuffer: Array<Types.LogLine> = []
  private _logLevel: Types.LogLevel
  private _writePeriod: number
  private _consoleLog: (...s: Array<any>) => void
  private _timerID: ReturnType<typeof requestIdleCallback> = 0

  constructor(logLevel: Types.LogLevel, ringSize: number, writePeriod: number) {
    this._logLevel = logLevel
    this._ringSize = ringSize
    this._writePeriod = writePeriod
    this._consoleLog = console[levelToFunction[logLevel]].bind(console)
    this.resetPeriodic()
  }

  log = (...s: Array<any>) => {
    const singleString = s.map(toStringForLog).join(' ')

    if (__DEV__) {
      this._consoleLog(s)
    }

    if (this._ringSize) {
      this._ringBuffer[this._currentWriteIdx] = [Date.now(), singleString]
      this._currentWriteIdx = (this._currentWriteIdx + 1) % this._ringSize
    }
  }

  private resetPeriodic = () => {
    if (!this._writePeriod) {
      return
    }

    this._timerID && cancelIdleCallback(this._timerID)
    this._timerID = requestIdleCallback(
      () => {
        this.dump()
          .then(() => {})
          .catch(() => {})
      },
      {timeout: this._writePeriod}
    ) as any as typeof this._timerID
  }

  dump = async () => {
    const toDump: Array<Types.LogLineWithLevelISOTimestamp> = []
    for (let i = 0; i < this._ringSize; i++) {
      const idxWrapped = (this._currentWriteIdx + i) % this._ringSize
      const s = this._ringBuffer[idxWrapped]
      if (s) {
        delete this._ringBuffer[idxWrapped]
        toDump.push([this._logLevel, new Date(s[0]).toISOString(), s[1]])
      }
    }
    await writeLogLinesToFile(toDump)
    this.resetPeriodic()
  }
}

export default RingAndPeriodLogger
