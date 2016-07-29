// @flow
import * as shared from './user-proofs.shared'
import React, {Component} from 'react'
import openUrl from '../util/open-url'
import type {Props, Proof} from './user-proofs'
import {Box, Icon, Meta, Text} from '../common-adapters/index'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {metaNone, checking as proofChecking} from '../constants/tracker'

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

  _renderProofRow (proof: Proof, idx: number) {
    const metaBackgroundColor = shared.metaColor(proof)
    const proofStatusIconType = shared.proofStatusIcon(proof)
    const proofNameStyle = shared.proofNameStyle(proof)
    const onClickProfile = () => { this._onClickProfile(proof) }

    const meta = proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundColor: metaBackgroundColor}} />

    const proofIcon = proofStatusIconType && <Icon type={proofStatusIconType} style={stylesStatusIcon} onClick={() => this._onClickProof(proof)} />

    return (
      <Box style={{...stylesRow, paddingTop: idx > 0 ? 8 : 0}} key={`${proof.id}${proof.type}`}>
        <Icon style={stylesService} type={shared.iconNameForProof(proof)} title={proof.type} onClick={onClickProfile} />
        <Box style={stylesProofNameSection}>
          <Box style={stylesProofNameLabelContainer}>
            <Text inline={true} type='Body' onPress={onClickProfile} style={stylesProofName}>
              <Text inline={true} type='Body' style={proofNameStyle}>{proof.name}</Text>
              <Text inline={true} type='Body' style={stylesProofType}>@{proof.type}</Text>
            </Text>
            {meta}
          </Box>
        </Box>
        {proofIcon}
      </Box>
    )
  }

  render () {
    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        {this.props.proofs.map((p, idx) => this._renderProofRow(p, idx))}
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
