// @flow
import {log, dump} from '../native/logger'
import type {Logger, LogLevel} from './types'
import {toStringForLog} from '../util/string'

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
        const [ts, logLine] = JSON.parse(l)
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
