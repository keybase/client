import {LogLineWithLevelISOTimestamp} from '../logger/types'
import {isMobile} from '../constants/platform'
import noop from 'lodash/noop'
import {getEngine} from '../engine/require'
import * as RPCTypes from '../constants/types/rpc-gen'

type Log = (...args: Array<any>) => void

const {localLog, localWarn, localError} = isMobile
  ? {
      localError: console.error.bind(console) as Log,
      localLog: (__DEV__ ? console.log.bind(console) : noop) as Log,
      localWarn: console.warn.bind(console) as Log,
    }
  : {
      localError: console.error.bind(console) as Log,
      localLog: console.log.bind(console) as Log,
      localWarn: console.warn.bind(console) as Log,
    }

const writeLogLinesToFile: (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void> = (
  lines: Array<LogLineWithLevelISOTimestamp>
) => {
  if (!isMobile) {
    // don't want main node thread making these calls
    try {
      if (!getEngine()) {
        return Promise.resolve()
      }
    } catch (_) {
      return Promise.resolve()
    }
  }
  return lines.length
    ? RPCTypes.configAppendGUILogsRpcPromise({
        content: lines.join('\n') + '\n',
      })
    : Promise.resolve()
}

export {localLog, localWarn, localError, writeLogLinesToFile}
