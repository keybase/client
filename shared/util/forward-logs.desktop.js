// @flow
import type {LogLineWithLevelISOTimestamp} from '../logger/types'

type Log = (...args: Array<any>) => void

export const localLog: Log = console.log.bind(console)
export const localWarn: Log = console.warn.bind(console)
export const localError: Log = console.error.bind(console)

export const writeLogLinesToFile: (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void> = (
  lines: Array<LogLineWithLevelISOTimestamp>
) => keybase.writeLogLinesToFile(lines)

export const deleteOldLog = (olderThanMs: number) => keybase.deleteOldLog(olderThanMs)
