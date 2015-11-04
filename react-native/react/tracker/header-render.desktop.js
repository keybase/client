'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

export default class HeaderRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <div style={{flex: 1, flexDirection: 'row'}}>
        <h1>You accessed /private/cecile</h1>
      </div>
    )
  }
}
