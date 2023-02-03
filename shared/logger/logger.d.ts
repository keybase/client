import type {LogLevel, LogLineWithLevel} from '.'
declare class Logger {
  constructor(logLevel: LogLevel, ringSize: number)
  log(...s: Array<any>): void
  // dump all lines
  dump(): Promise<Array<LogLineWithLevel>>
}

export default Logger
