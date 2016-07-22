/* @flow */

import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {Box, Icon, Text, Meta} from '../common-adapters/index'
import openUrl from '../util/open-url'
import * as shared from './user-proofs.shared'
import {metaNone, checking as proofChecking} from '../constants/tracker'

import type {Proof, Props, MissingProof} from './user-proofs'

export function MissingProofRow (proof: MissingProof, style: Object): React$Element {
  const missingColor = globalColors.black_20
  return (
    <p style={{...styleMissingProofRow, ...style}} className='user-proof-row' key={proof.type} onClick={() => proof.onClick(proof)}>
      <Icon style={{...styleService, color: missingColor}} type={shared.iconNameForProof(proof)} hint={proof.type} />
      <span style={styleProofNameSection}>
        <span style={styleProofNameLabelContainer}>
          <Text inline={true} className='user-proof-row__name' type='Body' style={{...styleProofName, color: missingColor}}>
            {proof.message}
          </Text>
        </span>
      </span>
      <Icon type={'iconfont-proof-good'} style={{...styleStatusIcon, color: missingColor}} />
    </p>
  )
}

export function ProofRow (proof: Proof, onClickProof: (proof: Proof) => void, onClickProfile: (proof: Proof) => void, style: Object): React$Element {
  const proofStatusIconType = shared.proofStatusIcon(proof)

  return (
    <p style={{...styleRow, ...style}} key={`${proof.id || ''}${proof.type}`}>
      <Icon style={styleService} type={shared.iconNameForProof(proof)} hint={proof.type} onClick={() => onClickProfile(proof)} />
      <span style={styleProofNameSection}>
        <span style={styleProofNameLabelContainer}>
          <Text inline={true} className='hover-underline-container' type='Body' onClick={() => onClickProfile(proof)} style={styleProofName}>
            <Text inline={true} type='Body' className='underline' style={shared.proofNameStyle(proof)}>{proof.name}</Text>
            {proof.id && <Text className='no-underline' inline={true} type='Body' style={styleProofType}><wbr />@{proof.type}<wbr /></Text>}
          </Text>
          {proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundcolor: shared.metaColor(proof)}} />}
        </span>
      </span>
      {proofStatusIconType && <Icon type={proofStatusIconType} style={styleStatusIcon} onClick={() => onClickProof(proof)} />}
    </p>
  )
}

function LoadingProofRow ({index, textBlockWidth, style}: {index: number, textBlockWidth: number, style: Object}) {
  // TODO(mm) make iconfont-proof-pending the unfinished one instead
  return (
    <div style={{...styleRow, ...style}}>
      <span style={styleProofNameSection}>
        <span style={styleProofNameLabelContainer}>
          <div style={{...globalStyles.loadingTextStyle, width: textBlockWidth}} />
        </span>
      </span>
      <Icon style={styleService} type={'iconfont-proof-pending'} />
    </div>
  )
}

class ProofsRender extends Component<void, Props, void> {

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

  render () {
    const {isLoading} = this.props
    const pad = idx => idx > 0 ? {marginTop: globalMargins.tiny} : {}
    const missingProofsRealCSS = `
      .user-proof-row .user-proof-row__name { text-underline: none; font-weight: normal; }
      .user-proof-row:hover .user-proof-row__name { text-decoration: underline; font-weight: bold; }
    `
    return (
      <Box style={{...styleContainer(isLoading), ...this.props.style}}>
        <Box style={{...styleLoading(isLoading)}} className='loading'>
          {[147, 77, 117].map((w, idx) => <LoadingProofRow key={idx} textBlockWidth={w} style={pad(idx)} />)}
        </Box>
        <Box style={{...styleDoneLoading(isLoading)}} className='notLoading'>
          {this.props.proofs && this.props.proofs.map((p, idx) => ProofRow(p, this._onClickProof, this._onClickProfile, pad(idx)))}
          {this.props.missingProofs && this.props.missingProofs.map((p, idx) => MissingProofRow(p, pad(idx)))}
          {this.props.missingProofs && <style>{missingProofsRealCSS}</style>}
        </Box>
      </Box>
    )
  }
}

const styleContainer = (isLoading) => ({
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  position: 'relative',
  minHeight: isLoading ? 120 : 0,
})

const styleLoading = (isLoading) => ({
  ...globalStyles.fadeOpacity,
  position: 'absolute',
  left: 0,
  right: 0,
  // We don't want the hidden loading state to affect sizings.
  height: 0,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  opacity: isLoading ? 1 : 0,
})

const styleDoneLoading = (isLoading) => ({
  ...globalStyles.fadeOpacity,
  opacity: !isLoading ? 1 : 0,
})

const styleRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
}

const styleMissingProofRow = {
  ...styleRow,
  ...globalStyles.clickable,
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
  ...globalStyles.selectable,
  width: 208,
  display: 'inline-block',
  wordBreak: 'break-all',
  flex: 1,
}

const styleProofType = {
  color: globalColors.black_10,
  wordBreak: 'normal',
}

export default ProofsRender
