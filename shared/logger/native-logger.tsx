import * as NL from '../native/logger'
import type {Logger, LogLine, LogLevel, Timestamp} from './types'
import {toStringForLog} from '../util/string'

const dumpLine = (timestamp: Timestamp, toLog: string) => {
  return JSON.stringify([timestamp, toLog])
}

// HACK: Match a stringified array with a number and a
// possibly-truncated string.
const lineRegex = /^[^0-9]*([0-9]+)[^"]*"(.*?)(?:"\s*\]?\s*)?$/

const parseLine = (l: string): LogLine => {
  const matches = l.match(lineRegex)
  if (!matches) {
    return [0, 'Unparseable log line: ' + l]
  }

  let ts = parseInt(matches[1], 10)
  // Shouldn't happen, but just in case.
  if (Number.isNaN(ts)) {
    ts = 0
  }

  return [ts, matches[2]]
}

// Uses the native logging mechanism (e.g. Log.i on Android)
class NativeLogger implements Logger {
  private _logLevel: LogLevel

  constructor(logLevel: LogLevel) {
    this._logLevel = logLevel
  }

  log = (...s: Array<any>) => {
    const toLog = s.map(toStringForLog).join(' ')
    NL.log(this._logLevel, dumpLine(Date.now(), toLog))
  }

  async dump() {
    return NL.dump(this._logLevel).then((lines: any) =>
      lines.map((l: string): any => {
        const [ts, logLine] = parseLine(l)
        return [this._logLevel, ts, logLine]
      })
    )
  }

  async flush() {
    NL.flush()
    return Promise.resolve()
  }
}

export {dumpLine, parseLine}
export default NativeLogger
