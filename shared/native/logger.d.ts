export type NativeLog = (tagPrefix: string, toLog: string) => void
export type NativeLogDump = (tagPrefix: string) => Promise<Array<string>>

declare const log: NativeLog
declare const dump: NativeLogDump

export {log, dump}
