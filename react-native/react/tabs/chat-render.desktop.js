'use strict'
/* @flow */

import React from 'react'
import BaseComponent from '../base-component'

export default class ChatRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <div>
        <h2> Chat goes here </h2>
        <p> Always Money in the Banana Stand </p>
      </div>
    )
  }
}
