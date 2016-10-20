// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Chat from './index'

class ChatContainer extends Component {
  render () {
    return <Chat />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Chat'}}
  }
}

export default connect()(ChatContainer)
