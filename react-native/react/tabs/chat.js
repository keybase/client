'use strict'

import React, { Component } from '../base-react'
import ChatRender from './chat-render'

export default class Chat extends Component {
  render () {
    return <ChatRender />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Chat'
      }
    }
  }
}
