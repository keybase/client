'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

export default class NoTabRender extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <div style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
        <p> Error! Tab name was not recognized</p>
      </div>
    )
  }
}
