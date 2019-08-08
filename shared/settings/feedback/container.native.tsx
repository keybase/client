import logger from '../../logger'
import * as React from 'react'
import {HOCTimers, PropsWithTimer} from '../../common-adapters'
import Feedback from './index'
import logSend from '../../native/log-send'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {isAndroid, version, logFileName, pprofDir} from '../../constants/platform'
import {writeLogLinesToFile} from '../../util/forward-logs'
import {Platform, NativeModules} from 'react-native'
import {getExtraChatLogsForLogSend, getPushTokenForLogSend} from '../../constants/settings'

type OwnProps = Container.RouteProps<{feedback: string}>

export type State = {
  sentFeedback: boolean
  sending: boolean
  sendError: Error | null
}
export type Props = PropsWithTimer<{
  chat: Object
  loggedOut: boolean
  push: Object
  onBack: () => void
  status: Object
  title: string
}>

const nativeBridge = NativeModules.KeybaseEngine
const appVersionName = nativeBridge.appVersionName || ''
const appVersionCode = nativeBridge.appVersionCode || ''
const mobileOsVersion = Platform.Version

class FeedbackContainer extends React.Component<Props, State> {
  static navigationOptions = {
    header: undefined,
    headerHeight: 60,
    title: 'Feedback',
  }

  mounted = false

  state = {
    sendError: null,
    sending: false,
    sentFeedback: false,
  }
  _dumpLogs = () => logger.dump().then(writeLogLinesToFile)

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
  }

  _onSendFeedback = (feedback: string, sendLogs: boolean, sendMaxBytes: boolean) => {
    this.setState({sending: true, sentFeedback: false})

    this.props.setTimeout(() => {
      const maybeDump = sendLogs ? this._dumpLogs() : Promise.resolve('')

      // @ts-ignore
      maybeDump
        .then(() => {
          const logPath = logFileName
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
            logPath,
            traceDir,
            cpuProfileDir
          )
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              sendError: null,
              sending: false,
              sentFeedback: true,
            })
          }
        })
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({
              sendError: err,
              sending: false,
              sentFeedback: false,
            })
          }
        })
    }, 0)
  }

  render() {
    return (
      <Feedback
        onSendFeedback={this._onSendFeedback}
        sending={this.state.sending}
        sendError={this.state.sendError}
        loggedOut={this.props.loggedOut}
        showInternalSuccessBanner={true}
        onFeedbackDone={() => null}
      />
    )
  }
}

// TODO really shouldn't be doing this in connect, should do this with an action

const connected = Container.compose(
  Container.connect(
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
    dispatch => ({
      onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
      title: 'Feedback',
    }),
    (s, d, o: OwnProps) => ({
      ...s,
      ...d,
      feedback: Container.getRouteProps(o, 'feedback', ''),
    })
  ),
  HOCTimers
)(FeedbackContainer)

export default connected
