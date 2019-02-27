// @flow
import * as React from 'react'
import * as Constants from '../../constants/tracker'
import * as Types from '../../constants/types/tracker2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'
import {formatTimeForAssertionPopup} from '../../util/timestamp'

type Props = {|
  color: Types.AssertionColor,
  isSuggestion: boolean,
  isYours: boolean,
  metas: $ReadOnlyArray<Types._AssertionMeta>,
  onCopyAddress: () => void,
  onRequestLumens: () => void,
  onRecheck: ?() => void,
  onRevoke: ?() => void,
  onSendLumens: () => void,
  onShowProof: () => void,
  onShowSite: () => void,
  onCreateProof: ?() => void,
  onWhatIsStellar: () => void,
  proofURL: string,
  siteIcon: $ReadOnlyArray<Types.SiteIcon>,
  siteIconFull: $ReadOnlyArray<Types.SiteIcon>,
  siteURL: string,
  state: Types.AssertionState,
  timestamp: number,
  type: string,
  value: string,
|}

const stateToIcon = state => {
  switch (state) {
    case 'checking':
      return 'iconfont-proof-pending'
    case 'valid':
      return 'iconfont-proof-good'
    case 'error': // fallthrough
    case 'warning':
    case 'revoked':
      return 'iconfont-proof-broken'
    case 'suggestion':
      return 'iconfont-proof-placeholder'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(state)
      throw new Error('Impossible')
  }
}

// alternate versions of the ones from `stateToIcon` for the popup menu header
const stateToDecorationIcon = state => {
  switch (state) {
    case 'checking':
      return 'icon-proof-pending'
    case 'valid':
      return 'icon-proof-success'
    case 'error':
    case 'warning':
    case 'revoked':
      return 'icon-proof-broken'
    case 'suggestion':
      return 'icon-proof-unfinished'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(state)
      throw new Error('impossible')
  }
}

const stateToValueTextStyle = state => {
  switch (state) {
    case 'revoked':
      return styles.strikeThrough
    case 'checking':
    case 'valid':
    case 'error':
    case 'warning':
    case 'suggestion':
      return null
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(state)
      throw new Error('Impossible')
  }
}

const assertionColorToColor = (c: Types.AssertionColor) => {
  switch (c) {
    case 'blue':
      return Styles.globalColors.blue
    case 'red':
      return Styles.globalColors.red
    case 'black':
      return Styles.globalColors.black
    case 'green':
      return Styles.globalColors.green
    case 'gray':
      return Styles.globalColors.black_50
    case 'yellow': // fallthrough
    case 'orange':
    default:
      return Styles.globalColors.red
  }
}

class _StellarValue extends React.PureComponent<
  Props & Kb.OverlayParentProps,
  {storedAttachmentRef: ?Kb.Box}
> {
  state = {storedAttachmentRef: null}
  // only set this once ever
  _storeAttachmentRef = storedAttachmentRef =>
    !this.state.storedAttachmentRef && this.setState({storedAttachmentRef})
  _getAttachmentRef = () => this.state.storedAttachmentRef
  render() {
    const menuItems = [
      {newTag: true, onClick: this.props.onSendLumens, title: 'Send Lumens (XLM)'},
      {newTag: true, onClick: this.props.onRequestLumens, title: 'Request Lumens (XLM)'},
      {onClick: this.props.onCopyAddress, title: 'Copy address'},
      'Divider',
      {onClick: this.props.onWhatIsStellar, title: 'What is Stellar?'},
    ]

    return Styles.isMobile ? (
      <Kb.Text
        type="BodyPrimaryLink"
        style={Styles.collapseStyles([styles.username, {color: assertionColorToColor(this.props.color)}])}
      >
        {this.props.value}
      </Kb.Text>
    ) : (
      <Kb.Box ref={r => this._storeAttachmentRef(r)} style={styles.tooltip}>
        <Kb.WithTooltip text={Styles.isMobile || this.props.showingMenu ? '' : 'Stellar Federation Address'}>
          <Kb.Text
            type="BodyPrimaryLink"
            onClick={this.props.toggleShowingMenu}
            style={Styles.collapseStyles([styles.username, {color: assertionColorToColor(this.props.color)}])}
          >
            {this.props.value}
          </Kb.Text>
        </Kb.WithTooltip>
        <Kb.FloatingMenu
          attachTo={this.state.storedAttachmentRef ? this._getAttachmentRef : undefined}
          closeOnSelect={true}
          containerStyle={undefined}
          items={menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </Kb.Box>
    )
  }
}
const StellarValue = Kb.OverlayParentHOC(_StellarValue)

const Value = p => {
  let content = null
  if (p.type === 'stellar' && !p.isSuggestion) {
    content = <StellarValue {...p} />
  } else {
    let str = p.value
    let style = styles.username

    if (!p.isSuggestion) {
      switch (p.type) {
        case 'pgp': {
          const last = p.value.substr(p.value.length - 16).toUpperCase()
          str = `${last.substr(0, 4)} ${last.substr(4, 4)} ${last.substr(8, 4)} ${last.substr(12, 4)}`
          break
        }
        case 'btc': // fallthrough
        case 'zcash':
          style = styles.crypto
          break
      }
    }

    content = (
      <Kb.Text
        type="BodyPrimaryLink"
        onClick={p.onCreateProof || p.onShowSite}
        style={Styles.collapseStyles([
          style,
          stateToValueTextStyle(p.state),
          {color: assertionColorToColor(p.color)},
        ])}
      >
        {str}
      </Kb.Text>
    )
  }

  return content
}

const siteIconToSrcSet = siteIcon =>
  `-webkit-image-set(${siteIcon
    .slice()
    .sort((a, b) => a.width - b.width)
    .map((si, idx) => `url(${si.path}) ${idx + 1}x`)
    .join(', ')})`
const siteIconToNativeSrcSet = siteIcon =>
  siteIcon.map(si => ({height: si.width, uri: si.path, width: si.width}))

const HoverOpacity = Styles.styled(Kb.Box)({
  '&:hover': {
    opacity: 1,
  },
  opacity: 0.5,
})

type State = {|showingMenu: boolean|}
class Assertion extends React.PureComponent<Props, State> {
  state = {showingMenu: false}
  _toggleMenu = () => this.setState(s => ({showingMenu: !s.showingMenu}))
  _hideMenu = () => this.setState({showingMenu: false})
  _ref = React.createRef()
  _getRef = () => this._ref.current
  _getMenu = () => {
    const p = this.props
    if (!p.isYours || p.isSuggestion || p.type === 'stellar') {
      return {}
    }

    const onRevoke = {
      danger: true,
      onClick: p.onRevoke,
      title: p.type === 'pgp' ? 'Drop' : 'Revoke',
    }

    if (p.metas.find(m => m.label === 'unreachable')) {
      return {
        header: {
          title: 'header',
          view: (
            <Kb.PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.red}>
              Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?
            </Kb.PopupHeaderText>
          ),
        },
        items: [
          {onClick: p.onShowProof, title: 'View proof'},
          {onClick: p.onRecheck, title: 'I fixed it - recheck'},
          onRevoke,
        ],
      }
    }

    if (p.metas.find(m => m.label === 'pending')) {
      let pendingMessage
      switch (p.type) {
        case 'hackernews':
          pendingMessage =
            'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
          break
        case 'dns':
          pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
          break
      }
      return {
        header: {
          title: 'header',
          view: pendingMessage ? (
            <Kb.PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.blue}>
              {pendingMessage}
            </Kb.PopupHeaderText>
          ) : null,
        },
        items: [onRevoke],
      }
    }

    return {
      header: {
        title: 'header',
        view: (
          <Kb.Box2
            direction="vertical"
            gap="tiny"
            centerChildren={true}
            style={styles.menuHeader}
            fullWidth={true}
          >
            <Kb.Box2 direction="vertical" style={styles.positionRelative}>
              {this._siteIcon(true)}
              <Kb.Icon type={stateToDecorationIcon(p.state)} style={styles.siteIconFullDecoration} />
            </Kb.Box2>
            {!!this.props.timestamp && (
              <>
                <Kb.Text type="BodySmall">Posted on</Kb.Text>
                <Kb.Text center={true} type="BodySmall">
                  {formatTimeForAssertionPopup(this.props.timestamp)}
                </Kb.Text>
              </>
            )}
          </Kb.Box2>
        ),
      },
      items: [{onClick: p.onShowProof, title: `View ${Constants.proofTypeToDesc(p.type)}`}, onRevoke],
    }
  }
  _siteIcon = (full: boolean) => {
    const set = full ? this.props.siteIconFull : this.props.siteIcon
    const style = full ? styles.siteIconFull : styles.siteIcon
    // on mobile use `Kb.RequireImage`, desktop a box with background-image
    let child
    if (Styles.isMobile) {
      child = <Kb.RequireImage src={siteIconToNativeSrcSet(set)} style={style} />
    } else {
      const Container = this.props.isSuggestion ? HoverOpacity : Kb.Box
      child = (
        <Container
          style={Styles.collapseStyles([
            style,
            {
              backgroundImage: siteIconToSrcSet(set),
            },
          ])}
        />
      )
    }
    return full ? (
      child
    ) : (
      <Kb.ClickableBox
        onClick={this.props.onCreateProof || this.props.onShowProof}
        style={this.props.isSuggestion ? styles.halfOpacity : null}
      >
        {child}
      </Kb.ClickableBox>
    )
  }
  render() {
    const p = this.props
    const {header, items} = this._getMenu()

    return (
      <Kb.Box2
        className="hover-container"
        ref={this._ref}
        direction="vertical"
        style={styles.container}
        fullWidth={true}
      >
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          gap="tiny"
          fullWidth={true}
          gapStart={true}
          gapEnd={true}
        >
          {this._siteIcon(false)}
          <Kb.Text type="Body" style={styles.textContainer}>
            <Value {...p} />
            {!p.isSuggestion && (
              <Kb.Text type="Body" style={styles.site}>
                @{p.type}
              </Kb.Text>
            )}
          </Kb.Text>
          <Kb.ClickableBox onClick={items ? this._toggleMenu : p.onShowProof}>
            <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
              <Kb.Icon
                type={stateToIcon(p.state)}
                fontSize={20}
                hoverColor={assertionColorToColor(p.color)}
                color={p.isSuggestion ? Styles.globalColors.black_20 : assertionColorToColor(p.color)}
              />
              {items ? (
                <>
                  <Kb.Icon className="hover-visible" type="iconfont-caret-down" sizeType="Tiny" />
                  <Kb.FloatingMenu
                    closeOnSelect={true}
                    visible={this.state.showingMenu}
                    onHidden={this._hideMenu}
                    attachTo={this._getRef}
                    position="bottom right"
                    containerStyle={styles.floatingMenu}
                    header={header}
                    items={items}
                  />
                </>
              ) : (
                <Kb.Box2 direction="vertical" />
              )}
            </Kb.Box2>
          </Kb.ClickableBox>
        </Kb.Box2>
        {!!p.metas.length && (
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.metaContainer}>
            {p.metas.map(m => (
              <Kb.Meta key={m.label} backgroundColor={assertionColorToColor(m.color)} title={m.label} />
            ))}
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {flexShrink: 0, paddingBottom: 4, paddingTop: 4},
  crypto: Styles.platformStyles({
    isElectron: {display: 'inline-block', fontSize: 11, wordBreak: 'break-all'},
  }),
  floatingMenu: {
    maxWidth: 240,
    minWidth: 196,
  },
  halfOpacity: Styles.platformStyles({
    isMobile: {opacity: 0.5}, // desktop is handled by emotion
  }),
  menuHeader: {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
    padding: Styles.globalMargins.small,
  },
  metaContainer: {flexShrink: 0, paddingLeft: 20 + Styles.globalMargins.tiny * 2 - 4}, // icon spacing plus meta has 2 padding for some reason
  positionRelative: {position: 'relative'},
  site: {color: Styles.globalColors.black_20},
  siteIcon: {flexShrink: 0, height: 16, width: 16},
  siteIconFull: Styles.platformStyles({
    common: {
      flexShrink: 0,
    },
    isElectron: {
      backgroundSize: 'contain',
      height: 48,
      width: 48,
    },
    isMobile: {
      height: 64,
      width: 64,
    },
  }),
  siteIconFullDecoration: {bottom: -8, position: 'absolute', right: -10},
  strikeThrough: {textDecorationLine: 'line-through'},
  textContainer: {flexGrow: 1, flexShrink: 1, marginTop: -1},
  tooltip: Styles.platformStyles({isElectron: {display: 'inline-flex'}}),
  username: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all'},
  }),
})

export default Assertion
