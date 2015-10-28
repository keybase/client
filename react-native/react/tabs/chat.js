'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import ChatRender from './chat-render'

export default class Chat extends BaseComponent {
  constructor (props) {
    super(props)
  }
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
