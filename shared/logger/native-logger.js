// @flow
import {log, dump} from '../native/logger'
import type {Logger, LogLine, LogLevel} from './types'
import {toStringForLog} from '../util/string'

const parseLine = (l: string): LogLine => {
  try {
    const [ts, logLine] = JSON.parse(l)
    return [ts, logLine]
  } catch (e) {
    if (!(e instanceof SyntaxError)) {
      return [0, 'Unparseable log line: ' + l]
    }
  }

  // HACK: Could be a truncated line, so try and fix it up.
  //
  // Remove this code once we're sure that most old log lines have
  // been aged out, and remove the SyntaxError type condition above.
  try {
    const [ts, logLine] = JSON.parse(l + '"]')
    return [ts, 'Fixed up log line: ' + logLine]
  } catch (e) {
    return [0, 'Unparseable log line, even with fixup: ' + l]
  }
}

let tagPrefix = 0
// Uses the native logging mechanism (e.g. Log.i on android)
class NativeLogger implements Logger {
  _tagPrefix: string

  constructor() {
    this._tagPrefix = tagPrefix++ + ''
  }

  log = (...s: Array<any>) => {
    const toLog = s.map(toStringForLog).join(' ')
    log(this._tagPrefix, JSON.stringify([Date.now(), toLog]))
  }

  dump(levelPrefix: LogLevel) {
    return dump(this._tagPrefix).then(lines =>
      lines.map(l => {
        const [ts, logLine] = parseLine(l)
        return [levelPrefix, ts, logLine]
      })
    )
  }

  flush() {
    const p: Promise<void> = Promise.resolve()
    return p
  }
}

export default NativeLogger
