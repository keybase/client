// @flow
import * as React from 'react'
import * as Types from '../../constants/types/tracker2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'

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
  siteIcon: string, // TODO handle actual urls, for now just use iconfont
  siteURL: string,
  state: Types.AssertionState,
  type: string,
  value: string,
|}

const stateToIcon = state => {
  switch (state) {
    case 'checking':
      return 'iconfont-proof-pending'
    case 'valid':
      return 'iconfont-proof-good'
    case 'error':
      return 'iconfont-proof-broken'
    case 'warning':
      return 'iconfont-proof-good'
    case 'revoked':
      return 'iconfont-proof-broken'
    case 'suggestion':
      return 'iconfont-proof-placeholder'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(state)
      throw new Error('Impossible')
  }
}

const stateToColor = state => {
  switch (state) {
    case 'checking':
      return Styles.globalColors.black_50
    case 'valid':
      return Styles.globalColors.blue2
    case 'error':
      return Styles.globalColors.red
    case 'warning':
      return Styles.globalColors.blue2
    case 'revoked':
      return Styles.globalColors.red
    case 'suggestion':
      return Styles.globalColors.grey
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
    case 'yellow':
      return Styles.globalColors.yellow2
    case 'orange':
      return Styles.globalColors.orange
    default:
      return Styles.globalColors.red
  }
}

// TODO get real icon from core
const siteIcon = icon => {
  switch (icon) {
    case 'btc':
      return 'iconfont-identity-bitcoin'
    case 'facebook':
      return 'iconfont-identity-facebook'
    case 'github':
      return 'iconfont-identity-github'
    case 'hackernews':
      return 'iconfont-identity-hn'
    case 'pgp':
      return 'iconfont-identity-pgp'
    case 'reddit':
      return 'iconfont-identity-reddit'
    case 'stellar':
      return 'iconfont-identity-stellar'
    case 'twitter':
      return 'iconfont-identity-twitter'
    case 'http':
      return 'iconfont-identity-website'
    case 'https':
      return 'iconfont-identity-website'
    case 'zcash':
      return 'iconfont-identity-zcash'
    default:
      return 'iconfont-identity-website'
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
        style={Styles.collapseStyles([style, {color: assertionColorToColor(p.color)}])}
      >
        {str}
      </Kb.Text>
    )
  }

  return content
}

const getMenu = p => {
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
        <Kb.Box2 direction="vertical" centerChildren={true} style={styles.menuHeader} fullWidth={true}>
          <Kb.Icon
            fontSize={Styles.isMobile ? 64 : 48}
            type={siteIcon(p.type)}
            onClick={p.onShowSite}
            color={Styles.globalColors.black_75}
          />
        </Kb.Box2>
      ),
    },
    items: [{onClick: p.onShowProof, title: `View ${p.type === 'btc' ? 'signature' : 'proof'}`}, onRevoke],
  }
}

type State = {|showingMenu: boolean|}
class Assertion extends React.PureComponent<Props, State> {
  state = {showingMenu: false}
  _toggleMenu = () => this.setState(s => ({showingMenu: !s.showingMenu}))
  _hideMenu = () => this.setState({showingMenu: false})
  _ref = React.createRef()
  _getRef = () => this._ref.current
  render() {
    const p = this.props
    const {header, items} = getMenu(p)

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
          <Kb.Icon
            type={siteIcon(p.type)}
            onClick={p.onCreateProof || p.onShowSite}
            color={p.isSuggestion ? Styles.globalColors.black_50 : Styles.globalColors.black_75}
          />
          <Kb.Text type="Body" style={styles.textContainer}>
            <Value {...p} />
            {!p.isSuggestion && (
              <Kb.Text type="Body" style={styles.site}>
                @{p.type}
              </Kb.Text>
            )}
          </Kb.Text>
          <Kb.Icon
            boxStyle={styles.stateIcon}
            type={stateToIcon(p.state)}
            fontSize={20}
            onClick={p.onShowProof}
            hoverColor={stateToColor(p.state)}
            color={p.isSuggestion ? Styles.globalColors.black_20 : assertionColorToColor(p.color)}
          />
          {items ? (
            <>
              <Kb.Icon className="hover-visible" type="iconfont-caret-down" onClick={this._toggleMenu} />
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
  menuHeader: {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
    padding: Styles.globalMargins.small,
  },
  metaContainer: {flexShrink: 0, paddingLeft: 20 + Styles.globalMargins.tiny * 2 - 4}, // icon spacing plus meta has 2 padding for some reason
  site: {color: Styles.globalColors.black_20},
  stateIcon: {height: 17},
  textContainer: {flexGrow: 1, flexShrink: 1, marginTop: -1},
  tooltip: Styles.platformStyles({isElectron: {display: 'inline-flex'}}),
  username: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all'},
  }),
})

export default Assertion
