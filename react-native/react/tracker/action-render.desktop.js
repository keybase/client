'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

export default class ActionRender extends BaseComponent {
  render () {
    return (
      <div style={{display: 'flex', flex: 1, justifyContent: 'space-between'}}>
        <h1>Follow alice_b</h1>
        <button style={{alignSelf: 'center'}}>Close</button>
      </div>
    )
  }
}
