'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

import Header from './header-render'
import Action from './action-render'
import Bio from './bio-render'
import Proofs from './proofs-render'

export default class Render extends BaseComponent {
  render () {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column'}}>
        <Header {...this.props} />
        <div style={{display: 'flex', flex: 1, flexDirection: 'row', height: 480}}>
          <Bio {...this.props} />
          <Proofs {...this.props} />
        </div>
        <Action {...this.props} />
      </div>
    )
  }
}

