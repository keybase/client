// @flow
import * as shared from './user-proofs.shared'
import Box from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import Meta from './meta'
import ProgressIndicator from './progress-indicator'
import * as React from 'react'
import Text from './text'
import openUrl from '../util/open-url'
import type {Proof} from '../constants/types/tracker'
import type {Props, MissingProof} from './user-proofs'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {metaNone, checking as proofChecking} from '../constants/tracker'

function MissingProofRow({missingProof, style}: {missingProof: MissingProof, style: Object}): React.Node {
  const missingColor = globalColors.black_20
  // TODO (AW): this is copied from desktop as a starting point for mobile
  return (
    <ClickableBox style={style} key={missingProof.type} onClick={() => missingProof.onClick(missingProof)}>
      <Box style={styleRow}>
        <Box style={iconContainer}>
          <Icon
            style={styleService}
            color={missingColor}
            fontSize={styleServiceContainer.fontSize}
            textAlign="center"
            type={shared.iconNameForProof(missingProof)}
            hint={missingProof.type}
          />
        </Box>
        <Box style={styleProofNameSection}>
          <Box style={styleProofNameLabelContainer}>
            <Text type="Body" style={{...styleProofName, color: missingColor}}>
              {missingProof.message}
            </Text>
          </Box>
        </Box>
        <Box style={styleStatusIconContainer}>
          <Icon type={'iconfont-proof-placeholder'} color={globalColors.black_10} fontSIze="26" />
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

function ProofRow({proof, onClickStatus, onClickProfile, hasMenu, style}: ProofRowProps): React.Element<any> {
  const proofStatusIconType = shared.proofStatusIcon(proof)

  return (
    <Box style={{...styleRow, ...style}} key={`${proof.id}${proof.type}`}>
      <Box style={iconContainer}>
        <Icon
          style={styleService}
          color={styleServiceContainer.color}
          fontSize={styleServiceContainer.fontSize}
          textAlign="center"
          type={shared.iconNameForProof(proof)}
          hint={proof.type}
          onClick={() => onClickProfile(proof)}
        />
      </Box>
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Text type="Body" onClick={() => onClickProfile(proof)} selectable={true} style={styleProofName}>
            <Text type="Body" style={shared.proofNameStyle(proof)}>
              {proof.name}
            </Text>
            {!!proof.id && (
              <Text type="Body" style={styleProofType}>
                @{proof.type}
              </Text>
            )}
          </Text>
          {proof.meta &&
            proof.meta !== metaNone && (
              <Meta title={proof.meta} backgroundColor={shared.metaColor(proof)} style={{marginTop: 1}} />
            )}
        </Box>
      </Box>
      <ClickableBox
        style={styleStatusIconTouchable}
        activeOpacity={0.8}
        underlayColor={globalColors.white}
        onClick={() => onClickStatus(proof)}
      >
        <Box style={styleStatusIconContainer} onClick={() => onClickStatus(proof)}>
          {proofStatusIconType &&
            (proof.state === proofChecking ? (
              <ProgressIndicator style={styleSpinner} />
            ) : (
              <Icon type={proofStatusIconType} fontSize={26} color={shared.proofColor(proof, true)} />
            ))}
          {hasMenu && <Icon type="iconfont-caret-down" />}
        </Box>
      </ClickableBox>
    </Box>
  )
}

function LoadingProofRow({width}: {width: number}): React.Element<any> {
  return (
    <Box style={styleRow}>
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Box style={{...globalStyles.loadingTextStyle, width, height: 16, borderRadius: 2}} />
        </Box>
      </Box>
      <Box style={styleStatusIconContainer}>
        <Icon type={'iconfont-proof-placeholder'} color={globalColors.lightGrey} fontSize={26} />
      </Box>
    </Box>
  )
}

function LoadingProofs() {
  return <Box>{[117, 147, 97].map((width, idx) => <LoadingProofRow key={idx} width={width} />)}</Box>
}

class ProofsRender extends React.Component<Props> {
  _ensureUrlProtocal(url: string): string {
    return url && (url.indexOf('://') === -1 ? 'http://' : '') + url
  }

  _onClickProof(proof: Proof): void {
    if (proof.humanUrl) {
      openUrl(this._ensureUrlProtocal(proof.humanUrl))
    }
  }

  _onClickProfile(proof: Proof): void {
    if (proof.profileUrl) {
      openUrl(this._ensureUrlProtocal(proof.profileUrl))
    }
  }

  render() {
    const {onClickProofMenu} = this.props
    if (this.props.loading) {
      return (
        <Box style={{...styleContainer, ...this.props.style}}>
          <LoadingProofs />
        </Box>
      )
    }

    return (
      <Box style={{...styleContainer, ...this.props.style}}>
        {this.props.type === 'proofs' &&
          this.props.proofs.map((p, idx) => (
            <ProofRow
              key={`${p.id || ''}${p.type}`}
              proof={p}
              onClickStatus={onClickProofMenu ? () => onClickProofMenu(idx) : p => this._onClickProof(p)}
              onClickProfile={p => this._onClickProfile(p)}
              hasMenu={!!onClickProofMenu}
              style={{minHeight: 32}}
            />
          ))}
        {this.props.type === 'missingProofs' &&
          this.props.missingProofs.map((mp, idx) => (
            <MissingProofRow key={mp.type} missingProof={mp} style={{minHeight: 32}} />
          ))}
      </Box>
    )
  }
}

const iconContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
  minHeight: 32,
  minWidth: 28,
}
const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
}
const styleRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  marginBottom: 2,
  marginTop: 2,
  // RN-BUG: set maxWidth once that prop is supported
}
const styleService = {
  marginRight: globalMargins.xtiny,
  marginTop: 2,
}
const styleServiceContainer = {
  color: globalColors.black_75,
  fontSize: 20,
}
const styleStatusIconTouchable = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-start',
}
const styleStatusIconContainer = {
  ...styleStatusIconTouchable,
  alignSelf: 'center',
  marginLeft: globalMargins.tiny,
  minWidth: 40,
}

const styleSpinner = {
  height: 32,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
  width: 32,
}
const styleProofNameSection = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  alignSelf: 'flex-start',
  flex: 1,
  paddingTop: globalMargins.tiny,
}
const styleProofNameLabelContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}
const styleProofName = {}
const styleProofType = {
  color: globalColors.black_20,
}

export default ProofsRender
