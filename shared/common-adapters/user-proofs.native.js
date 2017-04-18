// @flow
import * as shared from './user-proofs.shared'
import Box from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import Meta from './meta'
import ProgressIndicator from './progress-indicator'
import React, {Component} from 'react'
import Text from './text'
import openUrl from '../util/open-url'
import type {IconType} from './icon.constants'
import type {Proof} from '../constants/tracker'
import type {Props, MissingProof} from './user-proofs'
import {defaultColor} from './icon.shared'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {metaNone, checking as proofChecking} from '../constants/tracker'
import {omit} from 'lodash'

function MissingProofRow ({missingProof, style}: {missingProof: MissingProof, style: Object}): React$Element<*> {
  const missingColor = globalColors.black_20
  // TODO (AW): this is copied from desktop as a starting point for mobile
  return (
    <ClickableBox style={{...styleRow, flex: 1, ...style}} key={missingProof.type} onClick={() => missingProof.onClick(missingProof)}>
      <Box style={styleRow}>
        <Icon style={{...styleService, color: missingColor}} type={shared.iconNameForProof(missingProof)} hint={missingProof.type} />
        <Box style={styleProofNameSection}>
          <Box style={styleProofNameLabelContainer}>
            <Text type='Body' style={{...styleProofName, color: missingColor}}>
              {missingProof.message}
            </Text>
          </Box>
        </Box>
        <Box style={styleStatusIconContainer}>
          <Icon type={'iconfont-proof-placeholder'} style={{...styleStatusIcon('iconfont-proof-placeholder'), color: missingColor}} />
        </Box>
      </Box>
    </ClickableBox>
  )
}

type ProofRowProps = {
  proof: Proof,
  onClickStatus: (proof: Proof) => void,
  onClickProfile: (proof: Proof) => void,
  hasMenu: boolean,
  style: Object,
}

function ProofRow ({proof, onClickStatus, onClickProfile, hasMenu, style}: ProofRowProps): React$Element<*> {
  const proofStatusIconType = shared.proofStatusIcon(proof)

  return (
    <Box style={{...styleRow, ...style}} key={`${proof.id}${proof.type}`}>
      <Box style={iconContainer}>
        <Icon style={styleService} type={shared.iconNameForProof(proof)} hint={proof.type} onClick={() => onClickProfile(proof)} />
      </Box>
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Text type='Body' onClick={() => onClickProfile(proof)} style={styleProofName}>
            <Text type='Body' style={shared.proofNameStyle(proof)}>{proof.name}</Text>
            {!!proof.id && <Text type='Body' style={styleProofType}>@{proof.type}</Text>}
          </Text>
          {proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundColor: shared.metaColor(proof)}} />}
        </Box>
      </Box>
      <ClickableBox style={styleStatusIconTouchable} activeOpacity={0.8} underlayColor={globalColors.white} onClick={() => onClickStatus(proof)}>
        <Box style={styleStatusIconContainer} onClick={() => onClickStatus(proof)}>
          {proofStatusIconType && (proof.state === proofChecking ? <ProgressIndicator style={styleSpinner} /> : <Icon type={proofStatusIconType} />)}
          {hasMenu && <Icon type='iconfont-caret-down' />}
        </Box>
      </ClickableBox>
    </Box>
  )
}

function LoadingProofRow ({width, style}: {width: number, style: Object}): React$Element<*> {
  return (
    <Box style={{...styleRow, ...style}}>
      <Box style={{...(omit(styleService, ['fontSize', 'textAlign', 'color']))}} />
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Box style={{...globalStyles.loadingTextStyle, width, marginTop: 8, height: 16}} />
        </Box>
      </Box>
      <Icon type={'iconfont-proof-placeholder'} style={{...styleStatusIcon('iconfont-proof-placeholder'), color: globalColors.lightGrey}} />
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
        <Box style={{...styleContainer, backgroundColor: 'transparent', ...this.props.style}}>
          <LoadingProofs pad={pad} />
        </Box>
      )
    }

    return (
      <Box style={{...styleContainer, ...this.props.style}}>
        {this.props.type === 'proofs' && this.props.proofs.map((p, idx) =>
          <ProofRow
            key={`${p.id || ''}${p.type}`}
            proof={p}
            onClickStatus={onClickProofMenu ? () => onClickProofMenu(idx) : (p) => this._onClickProof(p)}
            onClickProfile={(p) => this._onClickProfile(p)}
            hasMenu={!!onClickProofMenu}
            style={{...pad(idx), minHeight: 24}} />
        )}
        {this.props.type === 'missingProofs' && this.props.missingProofs.map((mp, idx) =>
          <MissingProofRow
            key={mp.type}
            missingProof={mp}
            style={pad(idx)} />
        )}
      </Box>
    )
  }
}

const iconContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  minHeight: 32,
  minWidth: 24,
  width: 24,
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
}
const styleRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  // RN-BUG: set maxWidth once that prop is supported
}
const styleService = {
  ...globalStyles.clickable,
  color: globalColors.black_75,
  marginRight: globalMargins.tiny,
  textAlign: 'center',
  fontSize: 16,
}
const styleStatusIconTouchable = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-end',
}
const styleStatusIconContainer = {
  ...styleStatusIconTouchable,
}
const styleStatusIcon = (statusIcon: IconType) => ({
  color: defaultColor(statusIcon),
  marginLeft: globalMargins.xtiny,
  fontSize: 24,
})
const styleSpinner = {
  width: 20,
  height: 20,
}
const styleProofNameSection = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  alignSelf: 'flex-start',
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
  color: globalColors.black_20,
}

export default ProofsRender
