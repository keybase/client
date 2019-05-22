import {LogLineWithLevelISOTimestamp} from '../logger/types'

export declare function localLog(...args: any): void
export declare function localWarn(...args: any): void
export declare function localError(...args: any): void
export declare function writeLogLinesToFile(lines: Array<LogLineWithLevelISOTimestamp>): Promise<void>
