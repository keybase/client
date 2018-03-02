// @flow
import logger from '../logger'
import React, {Component} from 'react'
import {HeaderHoc, HOCTimers} from '../common-adapters'
import Feedback from './feedback.native'
import logSend from '../native/log-send'
import {compose, connect, type TypedState} from '../util/container'
import {
  isAndroid,
  appVersionName,
  appVersionCode,
  mobileOsVersion,
  version,
  logFileName,
  traceDir,
} from '../constants/platform'
import {type TimerProps} from '../common-adapters/hoc-timers'
import {writeLogLinesToFile} from '../util/forward-logs'

type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
  sendLogs: boolean,
  sendError: ?Error,
}

class FeedbackContainer extends Component<{status: string} & TimerProps, State> {
  mounted = false

  state = {
    sentFeedback: false,
    feedback: null,
    sending: false,
    sendLogs: false,
    sendError: null,
  }

  _onChangeSendLogs = (sendLogs: boolean) => this.setState({sendLogs})

  _onChangeFeedback = feedback => {
    this.setState(state => ({...state, feedback}))
  }

  _dumpLogs = () => logger.dump().then(writeLogLinesToFile)

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
  }

  _onSendFeedback = () => {
    this.setState(state => ({...state, sending: true, sentFeedback: false}))

    this.props.setTimeout(() => {
      const maybeDump = this.state.sendLogs ? this._dumpLogs() : Promise.resolve('')

      maybeDump
        .then(() => {
          const logPath = logFileName()
          logger.info(`Sending ${this.state.sendLogs ? 'log' : 'feedback'} to daemon`)
          return logSend(
            this.props.status,
            this.state.feedback || '',
            this.state.sendLogs,
            logPath,
            traceDir()
          )
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState(state => ({
              ...state,
              sentFeedback: true,
              feedback: null,
              sending: false,
              sendError: null,
            }))
          }
        })
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState(state => ({
              ...state,
              sentFeedback: false,
              sending: false,
              sendError: err,
            }))
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

export default compose(
  connect(
    (state: TypedState) => {
      return {
        status: JSON.stringify({
          username: state.config.username,
          uid: state.config.uid,
          deviceID: state.config.deviceID,
          mobileOsVersion,
          platform: isAndroid ? 'android' : 'ios',
          version,
          appVersionName,
          appVersionCode,
        }),
      }
    },
    (dispatch: Dispatch, {navigateUp}) => ({
      title: 'Feedback',
      onBack: () => dispatch(navigateUp()),
    })
  ),
  HeaderHoc,
  HOCTimers
)(FeedbackContainer)
