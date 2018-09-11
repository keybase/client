// @flow
import type {Logger, LogLevel, LogLineWithLevel} from './types'

class NullLogger implements Logger {
  log = (...s: Array<string>) => {}

  dump(levelPrefix: LogLevel) {
    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve([])
    return p
  }

  flush() {
    const p: Promise<void> = Promise.resolve()
    return p
  }
}

export default NullLogger
