// @flow
import React, {Component} from 'react'

import {HeaderHoc} from '../common-adapters'
import Feedback from './feedback'
import logSend from '../native/log-send'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'

import type {Dispatch} from '../constants/types/flux'

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

class FeedbackContainer extends Component<void, {}, State> {
  mounted = true

  state = {
    sentFeedback: false,
    feedback: null,
  }

  _onChangeFeedback = (feedback) => {
    this.setState({feedback})
  }

  componentWillUnmount () {
    this.mounted = false
  }

  render () {
    const onSendFeedback = (feedback, sendLogs) => {
      logSend(feedback, sendLogs).then(logSendId => {
        console.warn('logSendId is', logSendId)
        if (this.mounted) {
          this.setState({
            sentFeedback: true,
            feedback: null,
          })
        }
      })
    }

    return <FeedbackWrapped showSuccessBanner={this.state.sentFeedback} onSendFeedback={onSendFeedback} onChangeFeedback={this._onChangeFeedback} feedback={this.state.feedback} />
  }
}

export default compose(
  connect(
  null,
  (dispatch: Dispatch, {navigateUp}) => ({
    title: 'Feedback',
    onBack: () => dispatch(navigateUp()),
  })
  ),
  HeaderHoc
)(FeedbackContainer)
