'use strict'
/* @flow */

import React, {Component} from '../base-react'

import Header from './header-render'
import Action from './action-render'
import Bio from './bio-render'
import Proofs from './proofs-render'

export default class Render extends Component {
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

