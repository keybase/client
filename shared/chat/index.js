import React, {Component} from 'react'
import {connect} from 'react-redux'
import ChatRender from './index.render'

class Chat extends Component {
  render () {
    return <ChatRender />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Chat'}}
  }
}

export default connect()(Chat)
