// Separate type file because standard is failing

export type Timestamp = number
type ISOTimestamp = string

export type LogLevel = 'Error' | 'Warn' | 'Info' | 'Action' | 'Debug'

export type LogLine = [Timestamp, string]
export type LogLineWithLevel = [LogLevel, Timestamp, string]
export type LogLineWithLevelISOTimestamp = [LogLevel, ISOTimestamp, string]

export type LogFn = (...s: Array<any>) => void
export interface Logger {
  log: LogFn
  dump: () => Promise<Array<LogLineWithLevel>> // Should return an ordered array of log lines (ordered by timestamp);
  flush: () => Promise<void>
}

export type Loggers = {
  error: Logger
  warn: Logger
  info: Logger
  action: Logger
  debug: Logger
}
