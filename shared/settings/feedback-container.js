// @flow
import React, {Component} from 'react'

import Feedback from './feedback'
import {connect} from 'react-redux'

import type {TypedState} from '../constants/reducer'

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
    const onSendFeedback = (sendLogs, feedback) => {
      // logSend(feedback).then(logSendId => this.setState({sentFeedback: true}))
      console.log('sending feedback', sendLogs, feedback)
      this.setState({sentFeedback: true})
      this.setState({feedback: null})
    }

    return <Feedback showSuccessBanner={this.state.sentFeedback} onSendFeedback={onSendFeedback} onChangeFeedback={this._onChangeFeedback} feedback={this.state.feedback} />
  }
}

export default LogSend
