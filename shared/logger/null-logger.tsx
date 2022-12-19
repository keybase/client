import type {Logger, LogLineWithLevel} from './types'

class NullLogger implements Logger {
  log = () => {}

  async dump() {
    const p: Promise<Array<LogLineWithLevel>> = Promise.resolve([])
    return p
  }

  async flush() {
    const p: Promise<void> = Promise.resolve()
    return p
  }
}

export default NullLogger
