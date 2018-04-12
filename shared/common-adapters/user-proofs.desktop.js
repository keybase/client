// @flow
import * as React from 'react'
import {TransitionGroup, CSSTransition} from 'react-transition-group'
import * as shared from './user-proofs.shared'
import openUrl from '../util/open-url'
import type {Props, MissingProof} from './user-proofs'
import type {Proof} from '../constants/types/tracker'
import {Box, Icon, Text, Meta} from '../common-adapters/index'
import {defaultColor} from '../common-adapters/icon.shared'
import {globalStyles, globalColors, globalMargins, platformStyles, desktopStyles} from '../styles'
import {metaNone} from '../constants/tracker'

function MissingProofRow({missingProof}: {missingProof: MissingProof}): React.Node {
  const missingColor = globalColors.black_20
  return (
    <Box
      style={styleMissingProofRow}
      className="user-proof-row"
      key={missingProof.type}
      onClick={() => missingProof.onClick(missingProof)}
    >
      <Box style={iconContainer}>
        <Icon
          className="user-proof-row__icon"
          style={{...styleService, color: missingColor}}
          type={shared.iconNameForProof(missingProof)}
          hint={missingProof.type}
        />
      </Box>
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Text className="user-proof-row__name" type="Body" selectable={true} style={styleProofName}>
            {missingProof.message}
          </Text>
        </Box>
      </Box>
      <Icon
        type={'iconfont-proof-placeholder'}
        style={{...styleStatusIcon, color: globalColors.black_10, fontSize: 20}}
      />
    </Box>
  )
}

type ProofRowProps = {
  proof: Proof,
  hasMenu: boolean,
  showingMenu: boolean,
  onClickStatus: (proof: Proof) => void,
  onClickProfile: (proof: Proof) => void,
}

type ProofRowState = {
  hovering: boolean,
  popupMenuPosition: {},
}

class ProofRow extends React.PureComponent<ProofRowProps, ProofRowState> {
  state: ProofRowState
  _onMouseEnter: () => void
  _onMouseLeave: () => void

  constructor(props: ProofRowProps) {
    super(props)

    this.state = {
      hovering: false,
      popupMenuPosition: {},
    }

    this._onMouseEnter = () => this.setState({hovering: true})
    this._onMouseLeave = () => this.setState({hovering: false})
  }

  render() {
    const {proof, hasMenu, showingMenu, onClickProfile, onClickStatus} = this.props
    const proofStatusIconType = shared.proofStatusIcon(proof)
    const menuButtonVisible = this.state.hovering || showingMenu

    return (
      <Box style={styleRow} onMouseEnter={this._onMouseEnter} onMouseLeave={this._onMouseLeave}>
        <Box style={iconContainer}>
          <Icon
            style={styleService}
            type={shared.iconNameForProof(proof)}
            hint={proof.type}
            onClick={() => onClickProfile(proof)}
          />
        </Box>
        <Box style={styleProofNameSection}>
          <Box style={styleProofNameLabelContainer}>
            <Text
              className="hover-underline-container"
              type="Body"
              onClick={() => onClickProfile(proof)}
              selectable={true}
              style={styleProofName}
            >
              <Text
                inline={true}
                type="Body"
                className="hover-underline"
                style={platformStyles({
                  isElectron: {
                    ...shared.proofNameStyle(proof),
                    ...desktopStyles.clickable,
                  },
                })}
              >
                {proof.name}
              </Text>
              {proof.id && (
                <Text className="no-underline" type="Body" style={styleProofType}>
                  <wbr />@{proof.type}
                  <wbr />
                </Text>
              )}
            </Text>
            {proof.meta &&
              proof.meta !== metaNone && (
                <Meta title={proof.meta} style={{backgroundColor: shared.metaColor(proof), marginTop: 1}} />
              )}
          </Box>
        </Box>
        <Box style={styleProofMenuButton} onClick={() => onClickStatus(proof)}>
          {proofStatusIconType && (
            <Icon type={proofStatusIconType} style={{fontSize: 20, color: shared.proofColor(proof, true)}} />
          )}
          {hasMenu && (
            <Icon
              type="iconfont-caret-down"
              style={{
                transition: 'all .15s ease',
                color: proofStatusIconType && defaultColor(proofStatusIconType),
                marginLeft: menuButtonVisible ? globalMargins.xtiny - 2 : -12,
                opacity: menuButtonVisible ? 1 : 0,
              }}
            />
          )}
        </Box>
      </Box>
    )
  }
}

function LoadingProofRow({textBlockWidth}: {textBlockWidth: number}) {
  return (
    <Box style={styleRow}>
      <Box style={styleProofNameSection}>
        <Box style={styleProofNameLabelContainer}>
          <Box
            style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 2, width: textBlockWidth}}
          />
        </Box>
      </Box>
      <Icon
        style={{...styleStatusIcon, color: globalStyles.loadingTextStyle.backgroundColor, fontSize: 20}}
        type={'iconfont-proof-placeholder'}
      />
    </Box>
  )
}

// CSSTransition injects foreign props so lets not just accept all props
const IgnorePropsBox = ({children, onlyProps}: {children?: any, onlyProps?: any}) => (
  <Box {...onlyProps}>{children}</Box>
)

class ProofsRender extends React.Component<Props> {
  _rows: Array<any>

  constructor(props: Props) {
    super(props)
    this._rows = []
  }

  getRow(idx: number) {
    return this._rows[idx]
  }

  _onClickProof(proof: Proof): void {
    proof.humanUrl && openUrl(proof.humanUrl)
  }

  _onClickProfile(proof: Proof): void {
    proof.profileUrl && openUrl(proof.profileUrl)
  }

  render() {
    const {loading, onClickProofMenu, showingMenuIndex, style, loadingStyle} = this.props
    const missingProofsRealCSS = `
      .user-proof-row .user-proof-row__name {
        text-underline: none;
      }
      .user-proof-row:hover .user-proof-row__name {
        text-decoration: underline;
      }
      .user-proof-row .user-proof-row__name, .user-proof-row .user-proof-row__icon {
        color: ${
          globalColors.black_20
        } !important; /* Must use important because Text has a default color which is set inline */
      }
      .user-proof-row:hover .user-proof-row__name, .user-proof-row:hover .user-proof-row__icon {
        color: ${globalColors.black_60} !important;
      }
    `

    return (
      <Box style={{...styleContainer(loading), ...style}}>
        <TransitionGroup>
          {loading ? (
            <CSSTransition classNames="fade-anim" timeout={{exit: 250, enter: 250}}>
              <IgnorePropsBox key="loading" onlyProps={{style: {...styleLoading, ...loadingStyle}}}>
                {[147, 77, 117].map((w, idx) => <LoadingProofRow key={idx} textBlockWidth={w} />)}
              </IgnorePropsBox>
            </CSSTransition>
          ) : (
            <IgnorePropsBox key="non-loading">
              {this.props.type === 'proofs' &&
                this.props.proofs.map((p, idx) => (
                  <ProofRow
                    key={`${p.id || ''}${p.type}`}
                    ref={c => {
                      this._rows[idx] = c
                    }}
                    proof={p}
                    onClickStatus={onClickProofMenu ? () => onClickProofMenu(idx) : this._onClickProof}
                    onClickProfile={this._onClickProfile}
                    hasMenu={!!onClickProofMenu}
                    showingMenu={idx === showingMenuIndex}
                  />
                ))}
              {this.props.type === 'missingProofs' &&
                this.props.missingProofs.map((mp, idx) => (
                  <MissingProofRow key={mp.type} missingProof={mp} />
                ))}
              {this.props.type === 'missingProofs' && <style>{missingProofsRealCSS}</style>}
            </IgnorePropsBox>
          )}
        </TransitionGroup>
      </Box>
    )
  }
}

const styleContainer = loading => ({
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
}

const styleRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: 24,
}

const styleMissingProofRow = {
  ...styleRow,
  ...desktopStyles.clickable,
}

const iconContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  minHeight: 24,
  minWidth: 24,
  width: 24,
}

const styleService = {
  ...desktopStyles.clickable,
  color: globalColors.black_75,
  marginRight: globalMargins.tiny,
  height: 16,
  minHeight: 16,
  minWidth: 16,
  width: 16,
  textAlign: 'center',
  transition: '0.15s color',
}

const styleStatusIcon = {
  ...desktopStyles.clickable,
  width: 20,
  height: 20,
  minWidth: 20,
  minHeight: 20,
  marginLeft: 10,
  marginRight: 2,
}

const styleProofNameSection = {
  ...globalStyles.flexBoxRow,
  alignSelf: 'flex-start',
  alignItems: 'flex-start',
  marginTop: 2,
  flex: 1,
}

const styleProofNameLabelContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const styleProofName = platformStyles({
  isElectron: {
    ...desktopStyles.clickable,
    display: 'inline-block',
    wordBreak: 'break-all',
    flex: 1,
    transition: '0.15s color',
  },
})

const styleProofType = platformStyles({
  isElectron: {
    color: globalColors.black_20,
    wordBreak: 'normal',
  },
})

const styleProofMenuButton = {
  ...styleStatusIcon,
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  marginLeft: 10,
  minWidth: 34, // reserve space for menu dropdown caret
  alignItems: 'center',
  justifyContent: 'flex-end',
}

export default ProofsRender
