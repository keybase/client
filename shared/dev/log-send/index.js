// @flow
import React, {Component} from 'react'
import Render from './render'
import logSend from '../../native/log-send'

type State = {
  logSendId: ?string,
}

class LogSend extends Component<void, {}, State> {
  state: State

  constructor(props: {}) {
    super(props)
    this.state = {
      logSendId: null,
    }
  }

  render() {
    const onLogSend = () => {
      logSend('Sent from DEV MENU', true).then(logSendId =>
        this.setState({logSendId})
      )
    }

    return <Render logSendId={this.state.logSendId} onLogSend={onLogSend} />
  }
}

export default LogSend
