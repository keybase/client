import logger from '../../logger'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import Feedback from '.'
import logSend from '../../native/log-send'
import * as Container from '../../util/container'
import {isAndroid, version, pprofDir} from '../../constants/platform'
import {writeLogLinesToFile} from '../../util/forward-logs'
import {Platform} from 'react-native'
import {NativeModules} from '../../util/native-modules.native'
import {getExtraChatLogsForLogSend, getPushTokenForLogSend} from '../../constants/settings'

type OwnProps = Container.RouteProps<{heading: string; feedback: string}>

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

const appVersionName = NativeModules.KeybaseEngine.appVersionName
const appVersionCode = NativeModules.KeybaseEngine.appVersionCode
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
  private dumpLogs = async () => logger.dump().then(writeLogLinesToFile)

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
      const maybeDump = sendLogs ? this.dumpLogs() : Promise.resolve()

      maybeDump
        .then(async () => {
          logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
          const extra = sendLogs
            ? {...this.props.status, ...this.props.chat, ...this.props.push}
            : this.props.status
          const traceDir = pprofDir
          const cpuProfileDir = traceDir
          return logSend(
            JSON.stringify(extra),
            feedback || '',
            sendLogs,
            sendMaxBytes,
            traceDir,
            cpuProfileDir
          )
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              sendError: undefined,
              sending: false,
            })
          }
        })
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({
              sendError: err,
              sending: false,
            })
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
    feedback: Container.getRouteProps(o, 'feedback', ''),
  })
)(FeedbackContainer)

export default connected
