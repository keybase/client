import { LogLineWithLevelISOTimestamp } from '../logger/types';

export const localLog = (...args: any) => {}
export const localWarn = (...args: any) => {}
export const localError = (...args: any) => {}
export declare var writeLogLinesToFile: (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void>;
