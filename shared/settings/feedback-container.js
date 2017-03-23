// @flow
import React, {Component} from 'react'

import HeaderHoc from '../common-adapters/header-hoc'
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
    }

    return <FeedbackWrapped showSuccessBanner={this.state.sentFeedback} onSendFeedback={onSendFeedback} onChangeFeedback={this._onChangeFeedback} feedback={this.state.feedback} />
  }
}

export default connect(
  () => ({}),
  (dispatch: Dispatch, {navigateUp}) => ({
    title: 'Feedback',
    onBack: () => dispatch(navigateUp()),
  })
)(HeaderHoc(FeedbackContainer))
