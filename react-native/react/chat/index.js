import React, {Component} from '../base-react'
import {connect} from '../base-redux'
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
