import * as T from '@/constants/types'
import * as C from '@/constants'
import * as React from 'react'
import logger from '@/logger'
import {RPCError} from '@/util/errors'

export const getExtraChatLogsForLogSend = () => {
  return {}
}

export const useSendFeedback = () => {
  const [error, setError] = React.useState('')
  const sendFeedback = React.useCallback((feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    const f = async () => {
      // We don't want test devices (pre-launch reports) to send us log sends.
      if (C.androidIsTestDevice) {
        return
      }
      try {
        setError('')
        if (sendLogs) {
          await logger.dump()
        }
        const status = {C.version}
        logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
        const extra = sendLogs ? {...status, ...getExtraChatLogsForLogSend()} : status
        const logSendId = await T.RPCGen.configLogSendRpcPromise(
          {
            feedback: feedback || '',
            sendLogs,
            sendMaxBytes,
            statusJSON: JSON.stringify(extra),
          },
          C.Settings.sendFeedbackWaitingKey
        )
        logger.info('logSendId is', logSendId)
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        logger.warn('err in sending logs', error)
        setError(error.desc)
      }
    }
    C.ignorePromise(f())
  }, [])

  return {error, sendFeedback}
}
