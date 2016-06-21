/* @flow */

import React, {Component} from 'react'
import commonStyles from '../styles/common'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {Icon, Text, Meta} from '../common-adapters/index'
import {normal as proofNormal, checking as proofChecking, revoked as proofRevoked, error as proofError, warning as proofWarning} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaNone, metaIgnored} from '../constants/tracker'
import electron from 'electron'

import type {Props as IconProps} from '../common-adapters/icon'

const shell = electron.shell || electron.remote.shell

import type {Proof, Props} from './user-proofs'

class ProofsRender extends Component {
  props: Props;

  _openLink (url: string): void {
    shell.openExternal(url)
  }

  _onClickProof (proof: Proof): void {
    if (proof.state !== proofChecking) {
      proof.humanUrl && this._openLink(proof.humanUrl)
    }
  }

  _onClickProfile (proof: Proof): void {
    console.log('Opening profile link:', proof)
    if (proof.state !== proofChecking) {
      proof.profileUrl && this._openLink(proof.profileUrl)
    }
  }

  _iconNameForProof (proof: Proof): IconProps.type {
    return {
      'twitter': 'fa-twitter',
      'github': 'fa-github',
      'reddit': 'fa-reddit',
      'pgp': 'fa-key',
      'coinbase': 'fa-kb-iconfont-coinbase',
      'hackernews': 'fa-hacker-news',
      'rooter': 'fa-shopping-basket',
      'http': 'fa-globe',
      'https': 'fa-globe',
      'dns': 'fa-globe',
    }[proof.type]
  }

  _metaColor (proof: Proof): string {
    let color = globalColors.blue
    switch (proof.meta) {
      case metaNew: color = globalColors.blue; break
      case metaUpgraded: color = globalColors.blue; break
      case metaUnreachable: color = globalColors.red; break
      case metaPending: color = globalColors.black_40; break
      case metaDeleted: color = globalColors.red; break
      case metaIgnored: color = globalColors.green; break
    }
    return color
  }

  _proofColor (proof: Proof): string {
    let color = globalColors.blue
    switch (proof.state) {
      case proofNormal: {
        color = proof.isTracked ? globalColors.green2 : globalColors.blue
        break
      }
      case proofChecking:
        color = globalColors.black_20
        break
      case proofRevoked:
      case proofWarning:
      case proofError:
        color = globalColors.red
        break
    }

    if (proof.state === proofChecking) color = globalColors.black_20

    return color
  }

  _proofStatusIcon (proof: Proof): ?IconProps.type {
    switch (proof.state) {
      case proofChecking:
        return 'fa-kb-iconfont-proof-pending'

      case proofNormal:
        return proof.isTracked ? 'fa-kb-iconfont-proof-followed' : 'fa-kb-iconfont-proof-new'

      case proofWarning:
      case proofError:
      case proofRevoked:
        return 'fa-kb-iconfont-proof-broken'
      default:
        return null
    }
  }

  _renderProofRow (proof: Proof, idx: number) {
    const metaColor = this._metaColor(proof)
    const proofNameColor = this._proofColor(proof)
    const proofStatusIcon = this._proofStatusIcon(proof)
    const onClickProfile = () => { this._onClickProfile(proof) }

    const proofStyle = {
      ...globalStyles.selectable,
      width: 208,
      display: 'inline-block',
      wordBreak: 'break-all',
      ...styleProofName,
    }

    const proofNameStyle = {
      color: proofNameColor,
      ...(proof.meta === metaDeleted ? {textDecoration: 'line-through'} : {}),
    }

    const meta = proof.meta &&
      proof.meta !== metaNone &&
      <Meta title={proof.meta} style={{backgroundColor: metaColor}} />
    const proofIcon = proofStatusIcon && <Icon type={proofStatusIcon} style={styleStatusIcon} onClick={() => this._onClickProof(proof)} />

    return (
      <p style={{...styleRow, paddingTop: idx > 0 ? 8 : 0}} key={`${proof.id}${proof.type}`}>
        <Icon style={styleService} type={this._iconNameForProof(proof)} title={proof.type} onClick={onClickProfile} />
        <span style={styleProofNameSection}>
          <span style={styleProofNameLabelContainer}>
            <Text inline className='hover-underline-container' type='Body' onClick={onClickProfile} style={proofStyle}>
              <Text inline type='Body' className='underline' style={proofNameStyle}>{proof.name}</Text>
              <Text className='no-underline' inline type='Body' style={styleProofType}><wbr />@{proof.type}<wbr /></Text>
            </Text>
            {meta}
          </span>
        </span>
        {proofIcon}
      </p>
    )
  }

  render () {
    return (
      <div style={{...styleContainer, ...this.props.style}}>
        {this.props.proofs.map((p, idx) => this._renderProofRow(p, idx))}
      </div>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
}

const styleRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
}

const styleService = {
  ...globalStyles.clickable,
  fontSize: 15,
  width: 15,
  flexShrink: 0,
  textAlign: 'center',
  color: globalColors.black_75,
  hoverColor: globalColors.black_75,
  marginRight: globalMargins.tiny,
  marginTop: 5,
}

const styleStatusIcon = {
  ...globalStyles.clickable,
  fontSize: 20,
  marginLeft: 10,
  marginTop: 1,
}

const styleProofNameSection = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flex: 1,
}

const styleProofNameLabelContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const styleProofName = {
  ...commonStyles.clickable,
  flex: 1,
}

const styleProofType = {
  color: globalColors.black_10,
  wordBreak: 'normal',
}

export default ProofsRender
