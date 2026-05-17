import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Feedback from '.'
import logger from '@/logger'
import {Platform} from 'react-native'
import {getExtraChatLogsForLogSend, useSendFeedback} from './shared'
import {isAndroid, version, pprofDir} from '@/constants/platform'
import type {Props as OwnProps} from './container.shared'
import {usePushState} from '@/stores/push'
export type {Props} from './container.shared'

const mobileOsVersion = Platform.Version

const Connected = (ownProps: OwnProps) => {
  const feedback = ownProps.feedback ?? ''
  const loggedOut = useConfigState(s => !s.loggedIn)
  const _push = usePushState(s => s.token)
  const deviceID = useCurrentUserState(s => s.deviceID)
  const uid = useCurrentUserState(s => s.uid)
  const username = useCurrentUserState(s => s.username)
  const [mobileSending, setMobileSending] = React.useState(false)
  const [mobileSendError, setMobileSendError] = React.useState('')
  const timeoutIDRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const {sendFeedback: desktopSendFeedback, error: desktopError} = useSendFeedback()
  const desktopSending = C.Waiting.useAnyWaiting(C.waitingKeySettingsSendFeedback)
  const navigateUp = C.Router2.navigateUp

  React.useEffect(() => {
    return () => {
      if (timeoutIDRef.current) {
        clearTimeout(timeoutIDRef.current)
      }
    }
  }, [])

  if (Kb.Styles.isMobile) {
    const push = {pushToken: _push}
    const chat = getExtraChatLogsForLogSend()
    const rnkb = require('react-native-kb') as {
      appVersionName: string
      appVersionCode: string
      logSend: (
        extra: string,
        feedback: string,
        sendLogs: boolean,
        sendMaxBytes: boolean,
        traceDir: string,
        cpuProfileDir: string
      ) => Promise<string>
    }
    const {appVersionName, appVersionCode, logSend} = rnkb
    const _status = {
      appVersionCode,
      appVersionName,
      mobileOsVersion,
      platform: isAndroid ? 'android' : 'ios',
      version,
    }
    const status = {..._status, deviceID, uid, username}

    const _onSendFeedback = (f: string, sendLogs: boolean, sendMaxBytes: boolean) => {
      setMobileSending(true)
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
            f || '',
            sendLogs,
            sendMaxBytes,
            traceDir,
            cpuProfileDir
          )
          logger.info('logSendId is', logSendId)
          setMobileSendError('')
          setMobileSending(false)
        }
        run()
          .then(() => {})
          .catch((err: unknown) => {
            logger.warn('err in sending logs', err)
            setMobileSendError(String(err))
            setMobileSending(false)
          })
      }, 0)
    }

    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Feedback
          onSendFeedback={_onSendFeedback}
          sending={mobileSending}
          sendError={mobileSendError}
          loggedOut={loggedOut}
          showInternalSuccessBanner={true}
          onFeedbackDone={() => null}
          feedback={feedback}
        />
      </Kb.Box2>
    )
  }

  const onBack = () => navigateUp()
  const props = {
    feedback,
    loggedOut,
    onBack,
    onFeedbackDone: () => null,
    onSendFeedback: desktopSendFeedback,
    sendError: desktopError,
    sending: desktopSending,
    showInternalSuccessBanner: true,
  }
  return <Feedback {...props} />
}

export default Connected
