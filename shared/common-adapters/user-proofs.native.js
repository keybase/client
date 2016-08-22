// @flow
import * as shared from './user-proofs.shared'
import React, {Component} from 'react'
import openUrl from '../util/open-url'
import type {Proof} from '../constants/tracker'
import type {Props, MissingProof} from './user-proofs'
import {Box, Icon, Meta, Text, NativeTouchableHighlight} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {metaNone, checking as proofChecking} from '../constants/tracker'

function MissingProofRow ({missingProof, style}: {missingProof: MissingProof, style: Object}): React$Element<*> {
  const missingColor = globalColors.black_20
  // TODO (AW): this is copied from desktop as a starting point for mobile
  return (
    <NativeTouchableHighlight style={{...stylesRow, flex: 1, ...style}} key={missingProof.type} onPress={() => missingProof.onClick(missingProof)}>
      <Box style={stylesRow}>
        <Icon style={{...stylesService, color: missingColor}} type={shared.iconNameForProof(missingProof)} hint={missingProof.type} />
        <Box style={stylesProofNameSection}>
          <Box style={stylesProofNameLabelContainer}>
            <Text inline={true} type='Body' style={stylesProofName}>
              <Text inline={true} type='Body' style={{color: missingColor}}>{missingProof.message}</Text>
            </Text>
          </Box>
        </Box>
        <Icon type={'iconfont-proof-placeholder'} style={{...stylesStatusIcon, color: missingColor}} />
      </Box>
    </NativeTouchableHighlight>
  )
}

function ProofRow ({proof, onClickProof, onClickProfile, style}: {proof: Proof, onClickProof: (proof: Proof) => void, onClickProfile: (proof: Proof) => void, style: Object}): React$Element<*> {
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

class ProofsRender extends Component<void, Props, void> {
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
        {this.props.proofs && this.props.proofs.map((p, idx) => <ProofRow key={`${p.id || ''}${p.type}`} proof={p} onClickProof={this._onClickProof} onClickProfile={this._onClickProfile} style={pad(idx)} />)}
        {this.props.missingProofs && this.props.missingProofs.map((mp, idx) => <MissingProofRow key={mp.type} missingProof={mp} style={pad(idx)} />)}
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

export default ProofsRender
