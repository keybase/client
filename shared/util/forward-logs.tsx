import {LogLineWithLevelISOTimestamp} from '../logger/types'
import {noop} from 'lodash-es'
import {isMobile} from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'

type Log = (...args: Array<any>) => void

const {localLog, localWarn, localError} = isMobile
  ? {
      localError: window.console.error.bind(window.console) as Log,
      localLog: (__DEV__ ? window.console.log.bind(window.console) : noop) as Log,
      localWarn: window.console.warn.bind(window.console) as Log,
    }
  : {
      localError: console.error.bind(console) as Log,
      localLog: console.log.bind(console) as Log,
      localWarn: console.warn.bind(console) as Log,
    }

const writeLogLinesToFile: (lines: Array<LogLineWithLevelISOTimestamp>) => Promise<void> = (
  lines: Array<LogLineWithLevelISOTimestamp>
) =>
  lines.length
    ? RPCTypes.configAppendGUILogsRpcPromise({
        content: lines.join('\n') + '\n',
      })
    : Promise.resolve()

export {localLog, localWarn, localError, writeLogLinesToFile}
