// @flow
import logger from '../../logger'
import * as React from 'react'
import {HOCTimers} from '../../common-adapters'
import Feedback from './index'
import logSend from '../../native/log-send'
import {compose, connect, type RouteProps} from '../../util/container'
import {isAndroid, version, logFileName, pprofDir} from '../../constants/platform'
import {writeLogLinesToFile} from '../../util/forward-logs'
import {Platform, NativeModules} from 'react-native'
import {getExtraChatLogsForLogSend} from '../../constants/settings'
import type {PropsWithTimer} from '../../common-adapters'

type OwnProps = RouteProps<{}, {}>

export type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
  sendLogs: boolean,
  sendError: ?Error,
}
export type Props = PropsWithTimer<{
  chat: Object,
  onBack: () => void,
  status: Object,
  title: string,
}>

const nativeBridge = NativeModules.KeybaseEngine
const appVersionName = nativeBridge.appVersionName || ''
const appVersionCode = nativeBridge.appVersionCode || ''
const mobileOsVersion = Platform.Version

class FeedbackContainer extends React.Component<Props, State> {
  mounted = false

  state = {
    feedback: null,
    sendError: null,
    sendLogs: true,
    sending: false,
    sentFeedback: false,
  }

  _onChangeSendLogs = (sendLogs: boolean) => this.setState({sendLogs})

  _onChangeFeedback = feedback => {
    this.setState({feedback})
  }

  _dumpLogs = () => logger.dump().then(writeLogLinesToFile)

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
  }

  _onSendFeedback = () => {
    this.setState({sending: true, sentFeedback: false})

    this.props.setTimeout(() => {
      const maybeDump = this.state.sendLogs ? this._dumpLogs() : Promise.resolve('')

      maybeDump
        .then(() => {
          const logPath = logFileName
          logger.info(`Sending ${this.state.sendLogs ? 'log' : 'feedback'} to daemon`)
          const extra = this.state.sendLogs ? {...this.props.status, ...this.props.chat} : this.props.status
          const traceDir = pprofDir
          const cpuProfileDir = traceDir
          return logSend(
            JSON.stringify(extra),
            this.state.feedback || '',
            this.state.sendLogs,
            logPath,
            traceDir,
            cpuProfileDir
          )
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              feedback: null,
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
        showSuccessBanner={this.state.sentFeedback}
        onSendFeedbackContained={this._onSendFeedback}
        onChangeFeedback={this._onChangeFeedback}
        feedback={this.state.feedback}
        sending={this.state.sending}
        sendError={this.state.sendError}
        sendLogs={this.state.sendLogs}
        onChangeSendLogs={this._onChangeSendLogs}
      />
    )
  }
}

// TODO really shouldn't be doing this in connect, should do this with an action
const mapStateToProps = state => {
  return {
    chat: getExtraChatLogsForLogSend(state),
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
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  title: 'Feedback',
})

const connected = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...s, ...d})
  ),
  HOCTimers
)(FeedbackContainer)

// $FlowIssue
connected.navigationOptions = {
  header: undefined,
  headerHeight: 60,
  title: 'Feedback',
}

export default connected
