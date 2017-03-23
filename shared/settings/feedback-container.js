// @flow
import React, {Component} from 'react'

import Feedback from './feedback'
import logSend from '../native/log-send'
import {compose, withState, withHandlers} from 'recompose'

const FeedbackWrapped = compose(
  withState('sendLogs', 'onChangeSendLogs', true),
  withHandlers({
    onSendFeedbackContained: ({sendLogs, feedback, onSendFeedback}) => () => onSendFeedback(feedback, sendLogs),
  })
)(Feedback)

type State = {
  sentFeedback: boolean,
  feedback: ?string,
}

class LogSend extends Component<void, {}, State> {
  state: State;

  constructor (props: {}) {
    super(props)
    this.state = {
      sentFeedback: false,
      feedback: null,
    }
  }

  _onChangeFeedback = (feedback) => {
    this.setState({feedback})
  }

  render () {
    const onSendFeedback = (feedback, sendLogs) => {
      logSend(feedback, sendLogs).then(logSendId => {
        console.warn('logSendId is', logSendId)
        this.setState({
          sentFeedback: true,
          feedback: null,
        })
      })
      console.log('sending feedback', sendLogs, feedback)
    }

    return <FeedbackWrapped showSuccessBanner={this.state.sentFeedback} onSendFeedback={onSendFeedback} onChangeFeedback={this._onChangeFeedback} feedback={this.state.feedback} />
  }
}

export default LogSend
