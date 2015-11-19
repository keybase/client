'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'

import {error, pending} from '../constants/tracker'
import type {SimpleProofState} from '../constants/tracker'

export type Proof = {
  id: string,
  type: string,
  state: SimpleProofState,
  humanUrl: ?string,
  name: string,
  color: string
}

export type ProofsProps = {
  proofs: Array<Proof>
}

export default class ProofsRender extends Component {
  props: ProofsProps;

  // TODO hook this up
  openLink (url: string): void {
    window.open(url)
  }

  renderProofRow (proof: Proof): ReactElement {
    const onTouchTap = () => {
      if (proof.state !== pending) {
        console.log('should open hint link:', proof.humanUrl)
        proof.humanUrl && this.openLink(proof.humanUrl)
      } else {
        console.log('Proof is loading...')
      }
    }

    return (
      <div style={{display: 'flex'}}>
        <p title={proof.type} style={{width: 40, marginRight: 10, cursor: 'pointer'}} onTouchTap={onTouchTap}>
          Icon for: {proof.type}
        </p>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <p style={{textDecoration: proof.state === error ? 'line-through' : 'inherit', marginBottom: 0, cursor: 'pointer'}} onTouchTap={onTouchTap}>{proof.name}</p>
          <span style={{backgroundColor: proof.color}}>{proof.state}</span>
        </div>
        <div style={{display: 'flex', flex: 1, justifyContent: 'flex-end', paddingRight: 20}}>
          <p style={{cursor: 'pointer'}} onTouchTap={onTouchTap}>{proof.state}</p>
        </div>
      </div>
    )
  }

  render (): ReactElement {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', overflowY: 'auto'}}>
        {this.props.proofs.map(p => this.renderProofRow(p))}
      </div>
    )
  }
}

ProofsRender.propTypes = {
  proofs: React.PropTypes.any
}
