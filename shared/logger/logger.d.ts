import type * as Types from './types'
export declare class Logger {
  constructor(logLevel: Types.LogLevel, ringSize: number, writePeriod: number)
  log(...s: Array<any>): void
  // dump all lines to the service
  dump(): Promise<Array<Types.LogLineWithLevel>>
}
