export type NativeLog = (tagPrefix: string, toLog: string) => void
export type NativeLogDump = (tagPrefix: string) => Promise<Array<string>>

declare const log: NativeLog
declare const dump: NativeLogDump
declare const flush: () => void

export {log, dump, flush}
