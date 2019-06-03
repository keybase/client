import {Logger, LogLineWithLevel} from './types'

class NullLogger implements Logger {
  log = () => {}

  dump() {
    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve([])
    return p
  }

  flush() {
    const p: Promise<void> = Promise.resolve()
    return p
  }
}

export default NullLogger
