// @flow
import type {Logger, LogLevels, LogLineWithLevel} from './types'

// Simple in memory ring Logger
class NullLogger implements Logger {
  log = (...s: Array<string>) => {}

  dump(levelPrefix: LogLevels) {
    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve([])
    return p
  }

  flush() {}
}

export default NullLogger
