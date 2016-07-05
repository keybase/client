/* @flow */

import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {Icon, Text, Meta} from '../common-adapters/index'
import openUrl from '../util/open-url'
import * as shared from './user-proofs.shared'
import {metaNone} from '../constants/tracker'
import {checking as proofChecking} from '../constants/tracker'

import type {Proof, Props} from './user-proofs'

class ProofsRender extends Component {
  props: Props;

  _onClickProof (proof: Proof): void {
    if (proof.state !== proofChecking) {
      proof.humanUrl && openUrl(proof.humanUrl)
    }
  }

  _onClickProfile (proof: Proof): void {
    console.log('Opening profile link:', proof)
    if (proof.state !== proofChecking) {
      proof.profileUrl && openUrl(proof.profileUrl)
    }
  }

  _renderProofRow (proof: Proof, idx: number) {
    const metaBackgroundColor = shared.metaColor(proof)
    const proofStatusIconType = shared.proofStatusIcon(proof)
    const proofNameStyle = shared.proofNameStyle(proof)
    const onClickProfile = () => { this._onClickProfile(proof) }

    const proofStyle = {
      ...globalStyles.selectable,
      width: 208,
      display: 'inline-block',
      wordBreak: 'break-all',
      ...styleProofName,
    }

    const meta = proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundColor: metaBackgroundColor}} />

    const proofIcon = proofStatusIconType && <Icon type={proofStatusIconType} style={styleStatusIcon} onClick={() => this._onClickProof(proof)} />

    return (
      <p style={{...styleRow, paddingTop: idx > 0 ? 8 : 0}} key={`${proof.id}${proof.type}`}>
        <Icon style={styleService} type={shared.iconNameForProof(proof)} title={proof.type} onClick={onClickProfile} />
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
  ...globalStyles.clickable,
  flex: 1,
}

const styleProofType = {
  color: globalColors.black_10,
  wordBreak: 'normal',
}

export default ProofsRender
