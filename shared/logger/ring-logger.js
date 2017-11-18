// @flow
import type {LogLine, Logger, LogLevel, LogLineWithLevel} from './types'

// Simple in memory ring Logger
class RingLogger implements Logger {
  _ringSize: number
  _currentWriteIdx: number = 0
  _ringBuffer: Array<LogLine> = []

  constructor(ringSize: number) {
    this._ringSize = ringSize
  }

  log = (...s: Array<any>) => {
    const strings = s.map(s => (typeof s === 'object' ? JSON.stringify(s) : s))
    const singleString = strings.join(' ')
    this._ringBuffer[this._currentWriteIdx] = [Date.now(), singleString]
    this._currentWriteIdx = (this._currentWriteIdx + 1) % this._ringSize
  }

  dump(levelPrefix: LogLevel) {
    const toDump = []
    for (let i = 0; i < this._ringSize; i++) {
      const idxWrapped = (this._currentWriteIdx + i) % this._ringSize
      const s = this._ringBuffer[idxWrapped]
      if (s) {
        delete this._ringBuffer[idxWrapped]
        toDump.push([levelPrefix, s[0], s[1]])
      }
    }

    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve(toDump)
    return p
  }

  flush() {}
}

export default RingLogger
