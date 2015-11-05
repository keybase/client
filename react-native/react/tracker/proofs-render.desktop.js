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

  metaColor (pp) {
    return {
      'new': 'orange',
      deleted: 'red',
      unreachable: 'red',
      pending: 'gray'
    }[pp.proof.meta]
  }

  tempStatus (pp) {
    return {
      verified: '[v]',
      checking: '[c]',
      deleted: '[d]',
      unreachable: '[u]',
      pending: '[p]'
    }[pp.proof.status]
  }

  renderPlatformProof (pp) {
    const name = pp.platform.name === 'web' ? pp.platform.uri : pp.platform.name
    console.log(name)
    return (
      <div style={{display: 'flex'}}>
        <p title={name} style={{width: 40, marginRight: 10, cursor: 'pointer'}} onTouchTap={() => this.openLink(pp.platform.uri)}>{pp.platform.icon}</p>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <p style={{textDecoration: pp.proof.status === deleted ? 'line-through' : 'inherit', marginBottom: 0, cursor: 'pointer'}} onTouchTap={() => this.openLink(pp.platform.uri)}> {name}</p>
          <span style={{backgroundColor: this.metaColor(pp)}}>{pp.proof.meta}</span>
        </div>
        <div style={{display: 'flex', flex: 1, justifyContent: 'flex-end', paddingRight: 20}}>
          <p style={{cursor: 'pointer'}} onTouchTap={() => this.openLink(pp.proof.uri)}>{this.tempStatus(pp)}</p>
        </div>
      </div>
    )
  }

  render () {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', overflowY: 'auto'}}>
        { this.props.platformProofs && this.props.platformProofs.map(platformProof => this.renderPlatformProof(platformProof)) }
      </div>
    )
  }
}

ProofsRender.propTypes = {
  platformProofs: React.PropTypes.arrayOf(React.PropTypes.shape({
    platform: React.PropTypes.shape({
      icon: React.PropTypes.string.isRequired,
      name: React.PropTypes.string,
      username: React.PropTypes.string,
      uri: React.PropTypes.string
    }).isRequired,
    proof: React.PropTypes.shape({
      title: React.PropTypes.string,
      uri: React.PropTypes.string,
      status: React.PropTypes.oneOf([verified, checking, deleted, unreachable, pending]).isRequired,
      meta: React.PropTypes.string
    }).isRequired
  })).isRequired
}
