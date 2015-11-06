'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

// TODO const when integrating
const verified = 'verified'
const checking = 'checking'
const deleted = 'deleted'
const unreachable = 'unreachable'
const pending = 'pending'

export default class ProofsRender extends BaseComponent {
  openLink (proof, platform) {
    window.open(platform ? proof.platformLink : proof.proofLink)
  }

  metaColor (proof) {
    return {
      'new': 'orange',
      'deleted': 'red',
      'unreachable': 'red',
      'pending': 'gray'
    }[proof.meta]
  }

  renderProof (proof) {
    return (
      <div style={{display: 'flex'}}>
        <p title={proof.platform} style={{width: 40, marginRight: 10, cursor: 'pointer'}} onTouchTap={() => this.openLink(proof, true)}>{proof.platformIcon}</p>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <p style={{textDecoration: proof.status === deleted ? 'line-through' : 'inherit', marginBottom: 0, cursor: 'pointer'}} onTouchTap={() => this.openLink(proof, true)}> {proof.username}</p>
          <span style={{backgroundColor: this.metaColor(proof)}}>{proof.meta}</span>
        </div>
        <div style={{display: 'flex', flex: 1, justifyContent: 'flex-end', paddingRight: 20}}>
          <p style={{cursor: 'pointer'}} onTouchTap={() => this.openLink(proof, false)}>{proof.status}</p>
        </div>
      </div>
    )
  }

  render () {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', overflowY: 'auto'}}>
        { this.props.proofs && this.props.proofs.map(proof => this.renderProof(proof)) }
      </div>
    )
  }
}

ProofsRender.propTypes = {
  proofs: React.PropTypes.arrayOf(React.PropTypes.shape({
    platformIcon: React.PropTypes.string.isRequired,
    platform: React.PropTypes.string.isRequired,
    username: React.PropTypes.string.isRequired,
    status: React.PropTypes.oneOf([verified, checking, deleted, unreachable, pending]).isRequired,
    meta: React.PropTypes.string,
    platformLink: React.PropTypes.string,
    proofLink: React.PropTypes.string
  })).isRequired
}
