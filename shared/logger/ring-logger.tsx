import type * as Types from '.'
import {toStringForLog} from '../util/string'

const levelToFunction = {
  Action: 'log',
  Debug: 'log',
  Error: 'error',
  Info: 'info',
  Warn: 'warn',
} as const

// Simple in memory ring Logger
class RingLogger {
  private ringSize: number
  private currentWriteIdx: number = 0
  private ringBuffer: Array<Types.LogLine> = []
  private logLevel: Types.LogLevel
  private consoleLog: (...s: Array<any>) => void

  constructor(logLevel: Types.LogLevel, ringSize: number) {
    this.logLevel = logLevel
    this.ringSize = ringSize
    this.consoleLog = console[levelToFunction[logLevel]].bind(console)
  }

  log = (...s: Array<any>) => {
    const singleString = s.map(toStringForLog).join(' ')

    if (__DEV__) {
      this.consoleLog(this.logLevel, ...s)
    }

    if (this.ringSize) {
      this.ringBuffer[this.currentWriteIdx] = [Date.now(), singleString]
      this.currentWriteIdx = (this.currentWriteIdx + 1) % this.ringSize
    }
  }

  dump = () => {
    const toDump: Array<Types.LogLineWithLevel> = []
    for (let i = 0; i < this.ringSize; i++) {
      const idxWrapped = (this.currentWriteIdx + i) % this.ringSize
      const s = this.ringBuffer[idxWrapped]
      if (s) {
        delete this.ringBuffer[idxWrapped]
        toDump.push([this.logLevel, s[0], s[1]])
      }
    }
    return toDump
  }
}

export default RingLogger
