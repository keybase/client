// @flow
import React, {Component, PureComponent} from 'react'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'
import * as shared from './user-proofs.shared'
import openUrl from '../util/open-url'
import type {Props, MissingProof} from './user-proofs'
import type {Proof} from '../constants/tracker'
import {Box, Icon, Text, Meta} from '../common-adapters/index'
import {defaultColor} from '../common-adapters/icon.shared'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {metaNone, checking as proofChecking} from '../constants/tracker'

function MissingProofRow ({missingProof, style}: {missingProof: MissingProof, style: Object}): React$Element<*> {
  const missingColor = globalColors.black_20
  return (
    <Box style={{...styleMissingProofRow, ...style}} className='user-proof-row' key={missingProof.type} onClick={() => missingProof.onClick(missingProof)}>
      <Icon className='user-proof-row__icon' style={{...styleService, color: missingColor}} type={shared.iconNameForProof(missingProof)} hint={missingProof.type} />
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Text inline={true} className='user-proof-row__name' type='Body' style={styleProofName}>
            {missingProof.message}
          </Text>
        </Box>
      </Box>
      <Icon type={'iconfont-proof-placeholder'} style={{...styleStatusIcon, color: missingColor}} />
    </Box>
  )
}

type ProofRowProps = {
  proof: Proof,
  hasMenu: boolean,
  showingMenu: boolean,
  onClickStatus: (proof: Proof) => void,
  onClickProfile: (proof: Proof) => void,
  style: Object,
}

type ProofRowState = {
  hovering: boolean,
  popupMenuPosition: {},
}

class ProofRow extends PureComponent<void, ProofRowProps, ProofRowState> {
  state: ProofRowState;
  _onMouseEnter: () => void;
  _onMouseLeave: () => void;

  constructor (props: Props) {
    super(props)

    this.state = {
      hovering: false,
      popupMenuPosition: {},
    }

    this._onMouseEnter = () => this.setState({hovering: true})
    this._onMouseLeave = () => this.setState({hovering: false})
  }

  render () {
    const {proof, hasMenu, showingMenu, onClickProfile, onClickStatus, style} = this.props
    const proofStatusIconType = shared.proofStatusIcon(proof)
    const menuButtonVisible = this.state.hovering || showingMenu

    return (
      <Box style={{...styleRow, ...style}} onMouseEnter={this._onMouseEnter} onMouseLeave={this._onMouseLeave}>
        <Icon style={styleService} type={shared.iconNameForProof(proof)} hint={proof.type} onClick={() => onClickProfile(proof)} />
        <Box style={styleProofNameSection}>
          <Box style={styleProofNameLabelContainer}>
            <Text inline={true} className='hover-underline-container' type='Body' onClick={() => onClickProfile(proof)} style={styleProofName}>
              <Text inline={true} type='Body' className='underline' style={shared.proofNameStyle(proof)}>{proof.name}</Text>
              {proof.id && <Text className='no-underline' inline={true} type='Body' style={styleProofType}><wbr />@{proof.type}<wbr /></Text>}
            </Text>
            {proof.meta && proof.meta !== metaNone && <Meta title={proof.meta} style={{backgroundColor: shared.metaColor(proof)}} />}
          </Box>
        </Box>
        <Box style={styleProofMenuButton} onClick={() => onClickStatus(proof)}>
          {proofStatusIconType && <Icon type={proofStatusIconType} />}
          {hasMenu &&
            <Icon
              type='iconfont-caret-down'
              style={{
                transition: 'all .15s ease',
                color: proofStatusIconType && defaultColor(proofStatusIconType),
                marginLeft: menuButtonVisible ? globalMargins.xtiny - 2 : -8,
                opacity: menuButtonVisible ? 1 : 0,
              }}
            />
          }
        </Box>
      </Box>
    )
  }
}

function LoadingProofRow ({textBlockWidth, style}: {textBlockWidth: number, style: Object}) {
  // TODO(mm) make iconfont-proof-pending the unfinished one instead
  return (
    <Box style={{...styleRow, ...style}}>
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Box style={{...globalStyles.loadingTextStyle, width: textBlockWidth}} />
        </Box>
      </Box>
      <Icon style={{...styleStatusIcon, color: globalStyles.loadingTextStyle.backgroundColor}} type={'iconfont-proof-placeholder'} />
    </Box>
  )
}

class ProofsRender extends Component<void, Props, void> {
  _rows: Array<React$Element<*>>;

  constructor (props: Props) {
    super(props)
    this._rows = []
  }

  getRow (idx: number) {
    return this._rows[idx]
  }

  _onClickProof (proof: Proof): void {
    if (proof.state !== proofChecking) {
      proof.humanUrl && openUrl(proof.humanUrl)
    }
  }

  _onClickProfile (proof: Proof): void {
    if (proof.state !== proofChecking) {
      proof.profileUrl && openUrl(proof.profileUrl)
    }
  }

  render () {
    const {loading, onClickProofMenu, showingMenuIndex, style} = this.props
    const pad = idx => idx > 0 ? {marginTop: globalMargins.tiny} : {}
    const missingProofsRealCSS = `
      .user-proof-row .user-proof-row__name {
        text-underline: none;
      }
      .user-proof-row:hover .user-proof-row__name {
        text-decoration: underline;
      }
      .user-proof-row .user-proof-row__name, .user-proof-row .user-proof-row__icon {
        color: ${globalColors.black_20} !important; /* Must use important because Text has a default color which is set inline */
      }
      .user-proof-row:hover .user-proof-row__name, .user-proof-row:hover .user-proof-row__icon {
        color: ${globalColors.black_60} !important;
      }
    `
    return (
      <Box style={{...styleContainer(loading), ...style}}>
        <ReactCSSTransitionGroup transitionName='fade-anim' transitionEnterTimeout={250} transitionLeaveTimeout={250}>
          {loading
          ? (
            <Box key='loading' style={styleLoading}>
              {[147, 77, 117].map((w, idx) => <LoadingProofRow key={idx} textBlockWidth={w} style={pad(idx)} />)}
            </Box>)
          : (
            <Box key='non-loading'>
              {this.props.type === 'proofs' && this.props.proofs.map((p, idx) =>
                <ProofRow
                  key={`${p.id || ''}${p.type}`}
                  ref={c => { this._rows[idx] = c }}
                  proof={p}
                  onClickStatus={onClickProofMenu ? () => onClickProofMenu(idx) : this._onClickProof}
                  onClickProfile={this._onClickProfile}
                  hasMenu={!!onClickProofMenu}
                  showingMenu={idx === showingMenuIndex}
                  style={pad(idx)}
                />
              )}
              {this.props.type === 'missingProofs' && this.props.missingProofs.map((mp, idx) => <MissingProofRow key={mp.type} missingProof={mp} style={pad(idx)} />)}
              {this.props.type === 'missingProofs' && <style>{missingProofsRealCSS}</style>}
            </Box>)}
        </ReactCSSTransitionGroup>
      </Box>
    )
  }
}

const styleContainer = (loading) => ({
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  position: 'relative',
  minHeight: loading ? 120 : 0,
})

const styleLoading = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  // We don't want the hidden loading state to affect sizings.
  height: 0,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

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
  marginRight: globalMargins.tiny,
  marginTop: 5,
  transition: '0.15s color',
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
  display: 'inline-block',
  wordBreak: 'break-all',
  flex: 1,
  transition: '0.15s color',
}

const styleProofType = {
  color: globalColors.black_10,
  wordBreak: 'normal',
}

const styleProofMenuButton = {
  ...styleStatusIcon,
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  marginLeft: 10,
  marginTop: 1,
  minWidth: 34,  // reserve space for menu dropdown caret
  alignItems: 'center',
  justifyContent: 'flex-end',
}

export default ProofsRender
