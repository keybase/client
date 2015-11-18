'use strict'

import React, {Component} from '../base-react'

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

  prettyProofState (p: ProofState): string {
    return this.mapTagToName(identify.ProofState, p) || 'ERROR, proof state not recognized'
  }

  prettyName (p: RemoteProof): string {
    return p.value
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
