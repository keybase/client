// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Chat from './index'

import {loadInbox} from '../actions/chat'

class ChatContainer extends Component {
  componentWillMount () {
    this.props.loadInbox()
  }

  render () {
    return <Chat />
  }
}

export default connect(
  (state: any) => ({}),
  (dispatch: Dispatch) => ({
    loadInbox: () => dispatch(loadInbox()),
  })
)(ChatContainer)
