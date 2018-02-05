// @flow
import logger from '../logger'
import React, {Component} from 'react'
import {HeaderHoc, HOCTimers} from '../common-adapters'
import Feedback from './feedback'
import logSend from '../native/log-send'
import {compose, withState, withHandlers, connect, type TypedState} from '../util/container'
import {
  isAndroid,
  appVersionName,
  appVersionCode,
  mobileOsVersion,
  version,
  logFileName,
} from '../constants/platform'
import {type TimerProps} from '../common-adapters/hoc-timers'
import {writeLogLinesToFile} from '../util/forward-logs'

const FeedbackWrapped = compose(
  withState('sendLogs', 'onChangeSendLogs', true),
  withHandlers({
    onSendFeedbackContained: ({sendLogs, feedback, onSendFeedback}) => () =>
      onSendFeedback(feedback, sendLogs),
  })
)(Feedback)

type State = {
  sentFeedback: boolean,
  feedback: ?string,
  sending: boolean,
  sendError: string,
}

class FeedbackContainer extends Component<{status: string} & TimerProps, State> {
  mounted = false

  state = {
    sentFeedback: false,
    feedback: null,
    sending: false,
    sendError: '',
  }

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

  _onSendFeedback = (feedback, sendLogs) => {
    this.setState({sending: true, sentFeedback: false})

    this.props.setTimeout(() => {
      const maybeDump = sendLogs ? this._dumpLogs() : Promise.resolve('')

      maybeDump
        .then(() => {
          const path = logFileName()
          logger.info(`Sending ${sendLogs ? 'log' : 'feedback'} to daemon`)
          return logSend(this.props.status, feedback, sendLogs, path)
        })
        .then(logSendId => {
          logger.info('logSendId is', logSendId)
          if (this.mounted) {
            this.setState({
              sentFeedback: true,
              feedback: null,
              sending: false,
            })
          }
        })
        .catch(err => {
          logger.warn('err in sending logs', err)
          if (this.mounted) {
            this.setState({
              sentFeedback: false,
              sending: false,
            })
          }
        })
    }, 0)
  }

  render() {
    return (
      <FeedbackWrapped
        showSuccessBanner={this.state.sentFeedback}
        onSendFeedback={this._onSendFeedback}
        onChangeFeedback={this._onChangeFeedback}
        feedback={this.state.feedback}
        sending={this.state.sending}
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
