/* @flow */

import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {Box, Icon, Text, Meta} from '../common-adapters/index'
import openUrl from '../util/open-url'
import * as shared from './user-proofs.shared'
import {metaNone, checking as proofChecking} from '../constants/tracker'

import type {Proof, Props} from './user-proofs'

function LoadingProofRow ({index, textBlockWidth}: {index: number, textBlockWidth: number}) {
  // TODO(mm) make iconfont-proof-pending the unfinished one instead
  return (
    <div style={{...styleRow, paddingTop: index > 0 ? 8 : 0}}>
      <span style={styleProofNameSection}>
        <span style={styleProofNameLabelContainer}>
          <div style={{...globalStyles.loadingTextStyle, width: textBlockWidth}} />
        </span>
      </span>
      <Icon style={styleService} type={'iconfont-proof-pending'} />
    </div>
  )
}

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
        <Icon style={styleService} type={shared.iconNameForProof(proof)} hint={proof.type} onClick={onClickProfile} />
        <span style={styleProofNameSection}>
          <span style={styleProofNameLabelContainer}>
            <Text inline={true} className='hover-underline-container' type='Body' onClick={onClickProfile} style={proofStyle}>
              <Text inline={true} type='Body' className='underline' style={proofNameStyle}>{proof.name}</Text>
              <Text className='no-underline' inline={true} type='Body' style={styleProofType}><wbr />@{proof.type}<wbr /></Text>
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
        <Box style={{...styleLoading, opacity: this.props.loading ? 1 : 0}}>
          {[147, 77, 117].map((w, i) => <LoadingProofRow key={i} index={i} textBlockWidth={w} />)}
        </Box>
        <Box style={{...globalStyles.fadeOpacity, opacity: !this.props.loading ? 1 : 0}}>
          {this.props.proofs.map((p, idx) => this._renderProofRow(p, idx))}
        </Box>
      </div>
    )
  }
}

const styleLoading = {
  ...globalStyles.fadeOpacity,
  position: 'absolute',
  left: 0,
  right: 0,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  position: 'relative',
  minHeight: 120,
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
