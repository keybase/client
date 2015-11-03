'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

export default class ChatRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <div>
        <h2>About</h2>
        <p>Version 0.1</p>
      </div>
    )
  }
}
