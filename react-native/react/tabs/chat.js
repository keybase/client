'use strict'
/* @flow */

import BaseComponent from "../base-component"
import Render from "./chat-render"

export default class Chat extends BaseComponent {
  constructor (props) {
    super(props)
  }
  render () {
    return Render.apply(this)
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Chat'
      }
    }
  }
}
