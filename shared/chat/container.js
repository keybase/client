// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Chat from './index'

import {selectConversation} from '../actions/chat'

class ChatContainer extends Component {
  componentWillMount() {
    this.props.selectConversation()
  }

  render () {
    return <Chat />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Chat'}}
  }
}

export default connect(
  (state: any) => ({}),
  (dispatch: Dispatch) => ({
    selectConversation: () => dispatch(selectConversation('TEMPCHAT'))
  })
)(ChatContainer)
