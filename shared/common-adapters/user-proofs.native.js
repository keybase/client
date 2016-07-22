/* @flow */

import React, {Component} from 'react'
import {TouchableHighlight} from 'react-native'
import openUrl from '../util/open-url'
import * as shared from './user-proofs.shared'
import {metaNone, checking as proofChecking} from '../constants/tracker'
import {Box, Icon, Meta, Text} from '../common-adapters/index'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'

import type {Props, Proof, MissingProof} from './user-proofs'

export function MissingProofRow (proof: MissingProof, style: Object): React$Element {
  const missingColor = globalColors.black_20
  // TODO (AW): this is copied from desktop as a starting point for mobile
  return (
    <TouchableHighlight style={{...stylesRow, flex: 1, ...style}} key={proof.type} onPress={() => proof.onClick(proof)}>
      <Box style={stylesRow}>
        <Icon style={{...stylesService, color: missingColor}} type={shared.iconNameForProof(proof)} hint={proof.type} />
        <Box style={stylesProofNameSection}>
          <Box style={stylesProofNameLabelContainer}>
            <Text inline={true} type='Body' style={stylesProofName}>
              <Text inline={true} type='Body' style={{color: missingColor}}>{proof.message}</Text>
            </Text>
          </Box>
        </Box>
        <Icon type={'iconfont-proof-good'} style={{...stylesStatusIcon, color: missingColor}} />
      </Box>
    </TouchableHighlight>
  )
}

export function ProofRow (proof: Proof, onClickProof: (proof: Proof) => void, onClickProfile: (proof: Proof) => void, style: Object): React$Element {
  const proofStatusIconType = shared.proofStatusIcon(proof)

  return (
    <Box style={{...stylesRow, ...style}} key={`${proof.id}${proof.type}`}>
      <Icon style={stylesService} type={shared.iconNameForProof(proof)} hint={proof.type} onClick={() => onClickProfile(proof)} />
      <Box style={stylesProofNameSection}>
        <Box style={stylesProofNameLabelContainer}>
          <Text inline={true} type='Body' onPress={() => onClickProfile(proof)} style={stylesProofName}>
            <Text inline={true} type='Body' style={shared.proofNameStyle(proof)}>{proof.name}</Text>
            <Text inline={true} type='Body' style={stylesProofType}>@{proof.type}</Text>
          </Text>
          {proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundColor: shared.metaColor(proof)}} />}
        </Box>
      </Box>
      {proofStatusIconType && <Icon type={proofStatusIconType} style={stylesStatusIcon} onClick={() => onClickProof(proof)} />}
    </Box>
  )
}

export default class ProofsRender extends Component<void, Props, void> {

  _ensureUrlProtocal (url: string): string {
    return url && (url.indexOf('://') === -1 ? 'http://' : '') + url
  }

  _onClickProof (proof: Proof): void {
    if (proof.state !== proofChecking && proof.humanUrl) {
      openUrl(this._ensureUrlProtocal(proof.humanUrl))
    }
  }

  _onClickProfile (proof: Proof): void {
    if (proof.state !== proofChecking && proof.profileUrl) {
      openUrl(this._ensureUrlProtocal(proof.profileUrl))
    }
  }

  render () {
    const pad = idx => idx > 0 ? {paddingTop: globalMargins.tiny} : {}
    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        {this.props.proofs && this.props.proofs.map((p, idx) => ProofRow(p, this._onClickProof, this._onClickProfile, pad(idx)))}
        {this.props.missingProofs && this.props.missingProofs.map((p, idx) => MissingProofRow(p, pad(idx)))}
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  alignItems: 'stretch',
}
const stylesRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  // RN-BUG: set maxWidth once that prop is supported
}
const stylesService = {
  ...globalStyles.clickable,
  fontSize: 20,
  width: 22,
  textAlign: 'center',
  color: globalColors.black_75,
  marginRight: globalMargins.small,
}
const stylesStatusIcon = {
  ...globalStyles.clickable,
  fontSize: 24,
  marginLeft: globalMargins.small,
}
const stylesProofNameSection = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flex: 1,
}
const stylesProofNameLabelContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}
const stylesProofName = {
  ...globalStyles.clickable,
  flex: 1,
}
const stylesProofType = {
  color: globalColors.black_10,
}
