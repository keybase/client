// @flow
import type {LogLine, Logger, LogLevels, LogLineWithLevel} from './types'

// Simple in memory ring Logger
class RingLogger implements Logger {
  _ringSize: number
  _currentWriteIdx: number = 0
  _ringBuffer: Array<LogLine> = []

  constructor(ringSize: number) {
    this._ringSize = ringSize
  }

  log = (...s: Array<string>) => {
    const singleString = s.join(' ')
    this._ringBuffer[this._currentWriteIdx] = [Date.now(), singleString]
    this._currentWriteIdx = (this._currentWriteIdx + 1) % this._ringSize
  }

  dump(levelPrefix: LogLevels) {
    const toDump = []
    for (let i = 0; i < this._ringSize; i++) {
      const s = this._ringBuffer[this._currentWriteIdx]
      if (s) {
        delete this._ringBuffer[this._currentWriteIdx]
        toDump.push([levelPrefix, s[0], s[1]])
      }
    }

    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve(toDump)
    return p
  }

  flush() {}
}

export default RingLogger
