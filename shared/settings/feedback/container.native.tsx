import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Feedback from '.'
import logger from '@/logger'
import {Platform} from 'react-native'
import {getExtraChatLogsForLogSend} from './shared'
import {isAndroid, version, pprofDir} from '@/constants/platform'
import {logSend, appVersionName, appVersionCode} from 'react-native-kb'
import type {Props as OwnProps} from './container'
import {usePushState} from '@/stores/push'

export type Props = {
  chat: object
  feedback?: string
  loggedOut: boolean
  push: object
  status: object
}

const mobileOsVersion = Platform.Version

const _status = {
  appVersionCode,
  appVersionName,
  mobileOsVersion,
  platform: isAndroid ? 'android' : 'ios',
  version,
}

const Connected = (ownProps: OwnProps) => {
  const feedback = ownProps.feedback ?? ''
  const chat = getExtraChatLogsForLogSend()
  const loggedOut = useConfigState(s => !s.loggedIn)
  const _push = usePushState(s => s.token)
  const push = React.useMemo(() => ({pushToken: _push}), [_push])
  const deviceID = useCurrentUserState(s => s.deviceID)
  const uid = useCurrentUserState(s => s.uid)
  const username = useCurrentUserState(s => s.username)
  const [sending, setSending] = React.useState(false)
  const [sendError, setSendError] = React.useState('')
  const mountedRef = React.useRef(true)
  const timeoutIDRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  const status = React.useMemo(() => {
    return {..._status, deviceID, uid, username}
  }, [deviceID, uid, username])

  React.useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timeoutIDRef.current) {
        clearTimeout(timeoutIDRef.current)
      }
    }
  }, [])

  const _onSendFeedback = React.useCallback(
    (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
      setSending(true)

      timeoutIDRef.current = setTimeout(() => {
        const run = async () => {
          const maybeDump = sendLogs ? logger.dump() : Promise.resolve()
          await maybeDump
          logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
          const extra = sendLogs ? {...status, ...chat, ...push} : status
          const traceDir = pprofDir
          const cpuProfileDir = traceDir
          const logSendId = await logSend(
            JSON.stringify(extra),
            feedback || '',
            sendLogs,
            sendMaxBytes,
            traceDir,
            cpuProfileDir
          )
          logger.info('logSendId is', logSendId)
          if (mountedRef.current) {
            setSendError('')
            setSending(false)
          }
        }
        run()
          .then(() => {})
          .catch((err: unknown) => {
            logger.warn('err in sending logs', err)
            if (mountedRef.current) {
              setSendError(String(err))
              setSending(false)
            }
          })
      }, 0)
    },
    [status, chat, push]
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Feedback
        onSendFeedback={_onSendFeedback}
        sending={sending}
        sendError={sendError}
        loggedOut={loggedOut}
        showInternalSuccessBanner={true}
        onFeedbackDone={() => null}
        feedback={feedback}
      />
    </Kb.Box2>
  )
}

export default Connected
