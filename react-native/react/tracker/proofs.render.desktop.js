'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'

import {identify} from '../keybase_v1'

import type {RemoteProof, LinkCheckResult, ProofState, ProofStatus} from '../constants/types/flow-types'

export type ProofsAndChecks = Array<[RemoteProof, ?LinkCheckResult]>
export type ProofsProps = {
  proofsAndChecks: ProofsAndChecks
}

export default class ProofsRender extends Component {
  props: ProofsProps;

  // TODO hook this up
  openLink (url: string): void {
    window.open(url)
  }

  metaColor (lcr: ?LinkCheckResult): string {
    const colors = {
      none: 'red',
      ok: 'green',
      tempFailure: 'yellow',
      permFailure: 'red',
      looking: 'gray',
      superseded: 'gray',
      posted: 'gray',
      revoked: 'red'
    }

    if (!lcr) {
      return colors.looking
    }

    return colors[this.mapTagToName(identify.ProofState, lcr.proofResult.state) || 'looking']
  }

  mapTagToName (obj: any, tag: any): ?string {
    return Object.keys(obj).filter(x => obj[x] === tag)[0]
  }

  prettyProofState (p: ProofState): string {
    return this.mapTagToName(identify.ProofState, p) || 'ERROR, proof state not recognized'
  }

  prettyProofStatus (p: ProofStatus): string {
    return this.mapTagToName(identify.ProofStatus, p) || 'ERROR, proof status not recognized'
  }

  prettyName (p: RemoteProof): string {
    return p.value
  }

  tempStatus (lcr: ?LinkCheckResult): string {
    return lcr && this.prettyProofStatus(lcr.proofResult.status) || 'Pending'
  }

  renderPlatformProof (proof: RemoteProof, lcr: ?LinkCheckResult): ReactElement {
    const onTouchTap = () => {
      if (lcr && lcr.hint) {
        console.log('should open hint link:', lcr.hint.humanUrl)
      } else if (lcr && !lcr.hint) {
        console.log('No hint found for lcr!')
      } else {
        console.log('Link Check Result is loading...')
      }
    }

    const prettyProofState = lcr && this.prettyProofState(lcr.proofResult.state) || 'pending'

    const name = this.prettyName(proof)
    const type = this.mapTagToName(identify.ProofType, proof.proofType) || 'ERROR, proof type not recognized'

    return (
      <div style={{display: 'flex'}}>
        <p title={type} style={{width: 40, marginRight: 10, cursor: 'pointer'}} onTouchTap={onTouchTap}>
          Icon for: {type}
        </p>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <p style={{textDecoration: lcr && lcr.proofResult.state === identify.ProofState.permFailure ? 'line-through' : 'inherit', marginBottom: 0, cursor: 'pointer'}} onTouchTap={onTouchTap}> {name}</p>
          <span style={{backgroundColor: this.metaColor(lcr)}}>{prettyProofState}</span>
        </div>
        <div style={{display: 'flex', flex: 1, justifyContent: 'flex-end', paddingRight: 20}}>
          <p style={{cursor: 'pointer'}} onTouchTap={onTouchTap}>{this.tempStatus(lcr)}</p>
        </div>
      </div>
    )
  }

  render (): ReactElement {
    return (
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', overflowY: 'auto'}}>
        { this.props.proofsAndChecks.map(([p, lcr]) => this.renderPlatformProof(p, lcr)) }
      </div>
    )
  }
}

ProofsRender.propTypes = {
  proofsAndChecks: React.PropTypes.any
}
