// @flow
// Separate type file because standard is failing

type Timestamp = number

export type LogLevel = 'Error' | 'Warn' | 'Info' | 'Action' | 'Debug'

export type LogLine = [Timestamp, string]
export type LogLineWithLevel = [LogLevel, Timestamp, string]

export type LogFn = (...s: Array<any>) => void
export interface Logger {
  log: LogFn,
  dump(levelPrefix: LogLevel): Promise<Array<LogLineWithLevel>>, // Should return an ordered array of log lines (ordered by timestamp)
  flush(): void,
}

export interface AggregateLogger {
  constructor({
    error: Logger,
    warn: Logger,
    info: Logger,
    action: Logger,
    debug: Logger,
  }): void,
  error: LogFn,
  warn: LogFn,
  info: LogFn,
  action: LogFn,
  debug: LogFn,
  dump(filter?: Array<LogLevel>): Promise<Array<LogLineWithLevel>>, // Should return an ordered array of log lines (ordered by timestamp)
  flush(): void, // this calls flush on all logger impls
}
