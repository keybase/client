// @flow
import React, {Component} from 'react'
import {TouchableHighlight} from 'react-native'
import * as shared from './user-proofs.shared'
import openUrl from '../util/open-url'
import type {Proof} from '../constants/tracker'
import type {Props, MissingProof} from './user-proofs'
import {Box, Icon, Meta, Text} from '../common-adapters/index'
import type {IconType} from '../common-adapters/icon.constants'
import {defaultColor} from '../common-adapters/icon.shared'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {metaNone, checking as proofChecking} from '../constants/tracker'
import {omit} from 'lodash'

function MissingProofRow ({missingProof, style}: {missingProof: MissingProof, style: Object}): React$Element<*> {
  const missingColor = globalColors.black_20
  // TODO (AW): this is copied from desktop as a starting point for mobile
  return (
    <TouchableHighlight style={{...stylesRow, flex: 1, ...style}} key={missingProof.type} onPress={() => missingProof.onClick(missingProof)}>
      <Box style={stylesRow}>
        <Icon style={{...stylesService, color: missingColor}} type={shared.iconNameForProof(missingProof)} hint={missingProof.type} />
        <Box style={stylesProofNameSection}>
          <Box style={stylesProofNameLabelContainer}>
            <Text inline={true} type='Body' style={stylesProofName}>
              <Text inline={true} type='Body' style={{color: missingColor}}>{missingProof.message}</Text>
            </Text>
          </Box>
        </Box>
        <Box style={stylesStatusIconContainer}>
          <Icon type={'iconfont-proof-placeholder'} style={{...stylesStatusIcon('iconfont-proof-placeholder'), color: missingColor}} />
        </Box>
      </Box>
    </TouchableHighlight>
  )
}

type ProofRowProps = {
  proof: Proof,
  onClickStatus: (proof: Proof) => void,
  onClickProfile: (proof: Proof) => void,
  hasMenu: boolean,
  style: Object
}

function ProofRow ({proof, onClickStatus, onClickProfile, hasMenu, style}: ProofRowProps): React$Element<*> {
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
      <TouchableHighlight style={stylesStatusIconTouchable} activeOpacity={0.8} underlayColor={globalColors.white} onPress={() => onClickStatus(proof)}>
        <Box style={stylesStatusIconContainer} onClick={() => onClickStatus(proof)}>
          {proofStatusIconType && <Icon type={proofStatusIconType} style={stylesStatusIcon(proofStatusIconType)} onClick={() => onClickStatus(proof)} />}
          {proofStatusIconType && hasMenu && <Icon type='iconfont-caret-down' style={stylesStatusIconCaret(proofStatusIconType)} />}
        </Box>
      </TouchableHighlight>
    </Box>
  )
}

function LoadingProofRow ({width, style}: {width: number, style: Object}): React$Element<*> {
  return (
    <Box style={{...stylesRow, ...style}}>
      <Box style={{...(omit(stylesService, ['fontSize', 'textAlign', 'color']))}} />
      <Box style={stylesProofNameSection}>
        <Box style={stylesProofNameLabelContainer}>
          <Box style={{...globalStyles.loadingTextStyle, width, marginTop: 8, height: 16}} />
        </Box>
      </Box>
      <Icon type={'iconfont-proof-placeholder'} style={{...stylesStatusIcon('iconfont-proof-placeholder'), color: globalColors.lightGrey}} />
    </Box>
  )
}

function LoadingProofs ({pad}: {pad: (i: number) => Object}) {
  return (
    <Box>
      {[117, 147, 97].map((width, idx) => <LoadingProofRow key={idx} width={width} style={pad(idx)} />)}
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
    const {onClickProofMenu} = this.props
    const pad = idx => idx > 0 ? {paddingTop: globalMargins.tiny} : {}
    if (this.props.loading) {
      return (
        <Box style={{...stylesContainer, backgroundColor: 'transparent', ...this.props.style}}>
          <LoadingProofs pad={pad} />
        </Box>
      )
    }

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        {this.props.proofs && this.props.proofs.map((p, idx) =>
          <ProofRow
            key={`${p.id || ''}${p.type}`}
            proof={p}
            onClickStatus={onClickProofMenu ? () => onClickProofMenu(idx) : this._onClickProof}
            onClickProfile={this._onClickProfile}
            hasMenu={!!onClickProofMenu}
            style={pad(idx)} />
        )}
        {this.props.missingProofs && this.props.missingProofs.map((mp, idx) =>
          <MissingProofRow
            key={mp.type}
            missingProof={mp}
            style={pad(idx)} />
        )}
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
const stylesStatusIconTouchable = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-end',
}
const stylesStatusIconContainer = {
  ...stylesStatusIconTouchable,
}
const stylesStatusIcon = (statusIcon: IconType) => ({
  color: defaultColor(statusIcon),
  marginLeft: globalMargins.xtiny,
  fontSize: 24,
})
const stylesStatusIconCaret = (statusIcon: IconType) => ({
  ...globalStyles.clickable,
  color: defaultColor(statusIcon),
  fontSize: globalMargins.tiny,
  marginLeft: globalMargins.xtiny / 2,
  marginRight: -2 * globalMargins.tiny,
})
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
