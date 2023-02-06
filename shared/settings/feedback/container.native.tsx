import logger from '../../logger'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import Feedback from '.'
import * as Container from '../../util/container'
import {isAndroid, version, pprofDir} from '../../constants/platform'
import {Platform} from 'react-native'
import {getExtraChatLogsForLogSend, getPushTokenForLogSend} from '../../constants/settings'
import {logSend, appVersionName, appVersionCode} from 'react-native-kb'

type OwnProps = Container.RouteProps<'settingsTabs.feedbackTab'>

export type State = {
  sending: boolean
  sendError?: Error
}
export type Props = {
  chat: Object
  feedback: string
  loggedOut: boolean
  push: Object
  status: Object
}

const mobileOsVersion = Platform.Version

class FeedbackContainer extends React.Component<Props, State> {
  static navigationOptions = {
    header: undefined,
    title: 'Feedback',
    useHeaderHeight: () => 60,
  }

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

const connected = Container.connect(
  state => ({
    chat: getExtraChatLogsForLogSend(state),
    loggedOut: !state.config.loggedIn,
    push: getPushTokenForLogSend(state),
    status: {
      appVersionCode,
      appVersionName,
      deviceID: state.config.deviceID,
      mobileOsVersion,
      platform: isAndroid ? 'android' : 'ios',
      uid: state.config.uid,
      username: state.config.username,
      version,
    },
  }),
  () => ({}),
  (s, d, o: OwnProps) => ({
    ...s,
    ...d,
    feedback: o.route.params?.feedback ?? '',
  })
)(FeedbackContainer)

export default connected
