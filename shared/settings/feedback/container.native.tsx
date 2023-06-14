import * as Container from '../../util/container'
import * as ConfigConstants from '../../constants/config'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import Feedback from '.'
import logger from '../../logger'
import {Platform} from 'react-native'
import {getExtraChatLogsForLogSend} from '../../constants/settings'
import {isAndroid, version, pprofDir} from '../../constants/platform'
import {logSend, appVersionName, appVersionCode} from 'react-native-kb'
import type {Props as OwnProps} from './container'

export type State = {
  sending: boolean
  sendError?: Error
}
export type Props = {
  chat: Object
  feedback?: string
  loggedOut: boolean
  push: Object
  status: Object
}

const mobileOsVersion = Platform.Version

class FeedbackContainer extends React.Component<Props, State> {
  private mounted = false
  private timeoutID?: ReturnType<typeof setTimeout>

  state = {
    sendError: undefined,
    sending: false,
  }

  componentWillUnmount() {
    this.mounted = false
    if (this.timeoutID) {
      clearTimeout(this.timeoutID)
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  _onSendFeedback = (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    this.setState({sending: true})

    this.timeoutID = setTimeout(() => {
      const run = async () => {
        const maybeDump = sendLogs ? logger.dump() : Promise.resolve()
        await maybeDump
        logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
        const extra = sendLogs
          ? {...this.props.status, ...this.props.chat, ...this.props.push}
          : this.props.status
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
        if (this.mounted) {
          this.setState({
            sendError: undefined,
            sending: false,
          })
        }
      }
      run()
        .then(() => {})
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({sendError: err, sending: false})
          }
        })
    }, 0)
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Feedback
          onSendFeedback={this._onSendFeedback}
          sending={this.state.sending}
          sendError={this.state.sendError}
          loggedOut={this.props.loggedOut}
          showInternalSuccessBanner={true}
          onFeedbackDone={() => null}
          feedback={this.props.feedback}
        />
      </Kb.Box2>
    )
  }
}

// TODO really shouldn't be doing this in connect, should do this with an action

const getPushTokenForLogSend = (state: Container.TypedState) => ({pushToken: state.push.token})

const Connected = (ownProps: OwnProps) => {
  const feedback = ownProps.feedback ?? ''
  const chat = Container.useSelector(state => getExtraChatLogsForLogSend(state))
  const loggedOut = Container.useSelector(state => !state.config.loggedIn)
  const push = Container.useSelector(state => getPushTokenForLogSend(state))

  const deviceID = ConfigConstants.useCurrentUserState(s => s.deviceID)
  const uid = ConfigConstants.useCurrentUserState(s => s.uid)
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const status = {
    appVersionCode,
    appVersionName,
    deviceID,
    mobileOsVersion,
    platform: isAndroid ? 'android' : 'ios',
    uid,
    username,
    version,
  }

  const props = {
    chat,
    feedback,
    loggedOut,
    push,
    status,
  }
  return <FeedbackContainer {...props} />
}

export default Connected
