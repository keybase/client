import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {SiteIcon} from '@/profile/generic/shared'
import {formatTimeForAssertionPopup} from '@/util/timestamp'

type Props = {
  color: T.Tracker.AssertionColor
  isSuggestion: boolean
  isYours: boolean
  metas: ReadonlyArray<T.Tracker.AssertionMeta>
  notAUser: boolean
  onHideStellar: (hidden: boolean) => void
  onRecheck?: () => void
  onRevoke?: () => void
  onShowProof?: () => void
  onShowSite?: () => void
  onCreateProof?: () => void
  proofURL: string
  siteIcon?: T.Tracker.SiteIconSet
  siteIconDarkmode?: T.Tracker.SiteIconSet
  siteIconFull?: T.Tracker.SiteIconSet
  siteIconFullDarkmode?: T.Tracker.SiteIconSet
  siteURL: string
  state: T.Tracker.AssertionState
  stellarHidden: boolean
  timestamp: number
  type: string
  value: string
}

const proofTypeToDesc = (proofType: string) => {
  switch (proofType) {
    case 'btc':
    case 'zcash':
      return 'signature'
    default:
      return 'proof'
  }
}

const stateToIcon = (state: T.Tracker.AssertionState) => {
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
      return 'iconfont-proof-pending'
  }
}

// alternate versions of the ones from `stateToIcon` for the popup menu header
const stateToDecorationIcon = (state: T.Tracker.AssertionState) => {
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
      return 'icon-proof-pending'
  }
}

const stateToValueTextStyle = (state: T.Tracker.AssertionState) => {
  switch (state) {
    case 'revoked':
      return styles.strikeThrough
    case 'checking':
    case 'valid':
    case 'error':
    case 'warning':
    case 'suggestion':
    default:
      return null
  }
}

const assertionColorToTextColor = (c: T.Tracker.AssertionColor) => {
  switch (c) {
    case 'blue':
      return Kb.Styles.globalColors.blueDark
    case 'red':
      return Kb.Styles.globalColors.redDark
    case 'black':
      return Kb.Styles.globalColors.black
    case 'green':
      return Kb.Styles.globalColors.greenDark
    case 'gray':
      return Kb.Styles.globalColors.black_50
    case 'yellow': // fallthrough
    case 'orange':
    default:
      return Kb.Styles.globalColors.redDark
  }
}

const assertionColorToColor = (c: T.Tracker.AssertionColor) => {
  switch (c) {
    case 'blue':
      return Kb.Styles.globalColors.blue
    case 'red':
      return Kb.Styles.globalColors.red
    case 'black':
      return Kb.Styles.globalColors.black
    case 'green':
      return Kb.Styles.globalColors.green
    case 'gray':
      return Kb.Styles.globalColors.black_50
    case 'yellow': // fallthrough
    case 'orange':
    default:
      return Kb.Styles.globalColors.red
  }
}

const StellarValue = (p: Props) => {
  const {value, color} = p

  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopyAddress = React.useCallback(() => {
    copyToClipboard(value)
  }, [copyToClipboard, value])

  const menuItems: Kb.MenuItems = React.useMemo(
    () => [{onClick: onCopyAddress, title: 'Copy address'}],
    [onCopyAddress]
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={hidePopup}
          visible={true}
          position="bottom center"
        />
      )
    },
    [menuItems]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const label = (
    <Kb.Text
      type="BodyPrimaryLink"
      onClick={Kb.Styles.isMobile ? undefined : showPopup}
      tooltip={popup ? undefined : 'Stellar Federation Address'}
      style={Kb.Styles.collapseStyles([styles.username, {color: assertionColorToTextColor(color)}])}
    >
      {value}
    </Kb.Text>
  )

  return Kb.Styles.isMobile ? (
    label
  ) : (
    <Kb.Box2Measure direction="vertical" ref={popupAnchor} style={styles.tooltip}>
      {label}
      {popup}
    </Kb.Box2Measure>
  )
}

const Value = (p: Props) => {
  let content: React.JSX.Element | null
  if (p.type === 'stellar' && !p.isSuggestion) {
    content = <StellarValue {...p} />
  } else {
    let str = p.value
    let style: Kb.Styles.StylesCrossPlatform = styles.username

    if (!p.isSuggestion) {
      switch (p.type) {
        case 'pgp': {
          const last = p.value.substring(p.value.length - 16).toUpperCase()
          str = `${last.substring(0, 4)} ${last.substring(4, 8)} ${last.substring(8, 12)} ${last.substring(
            12,
            16
          )}`
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
        type={p.notAUser ? 'Body' : 'BodyPrimaryLink'}
        onClick={p.onCreateProof || p.onShowSite}
        style={Kb.Styles.collapseStyles([
          style,
          stateToValueTextStyle(p.state),
          {color: assertionColorToTextColor(p.color)},
        ])}
      >
        {str}
      </Kb.Text>
    )
  }

  return content
}

const HoverOpacity = (p: {children: React.ReactNode}) => (
  <Kb.Box className="hover-opacy inverted">{p.children}</Kb.Box>
)

type SIProps = {
  full: boolean
} & Pick<
  Props,
  | 'siteIconFullDarkmode'
  | 'siteIconFull'
  | 'siteIconDarkmode'
  | 'siteIcon'
  | 'onCreateProof'
  | 'onShowProof'
  | 'isSuggestion'
>
const AssertionSiteIcon = (p: SIProps) => {
  const {full, siteIconFullDarkmode, siteIconFull, siteIconDarkmode, siteIcon} = p
  const {onCreateProof, onShowProof, isSuggestion} = p
  const isDarkMode = React.useContext(Kb.Styles.DarkModeContext)
  const set = full
    ? isDarkMode
      ? siteIconFullDarkmode
      : siteIconFull
    : isDarkMode
      ? siteIconDarkmode
      : siteIcon
  if (!set) return null
  let child = <SiteIcon full={full} set={set} />
  if (full) {
    return child
  }
  if (!Kb.Styles.isMobile && isSuggestion) {
    child = <HoverOpacity>{child}</HoverOpacity>
  }
  return (
    <Kb.ClickableBox onClick={onCreateProof || onShowProof} style={isSuggestion ? styles.halfOpacity : null}>
      {child}
    </Kb.ClickableBox>
  )
}

const Assertion = React.memo(function Assertion(p: Props) {
  const {isYours, isSuggestion, stellarHidden, type, metas, onHideStellar, onRevoke: _onRevoke} = p
  const {onShowProof, onRecheck, onCreateProof, state, timestamp, color, notAUser} = p
  const {siteIconFullDarkmode, siteIconFull, siteIconDarkmode, siteIcon} = p
  const {header, items} = React.useMemo(() => {
    if (!isYours || isSuggestion) {
      return {}
    }
    const onRevoke =
      type === 'stellar'
        ? {
            danger: true,
            onClick: () => onHideStellar(!stellarHidden),
            title: `${stellarHidden ? 'Show' : 'Hide'} Stellar address on profile`,
          }
        : {
            danger: true,
            onClick: _onRevoke,
            title: type === 'pgp' ? 'Drop' : 'Revoke',
          }

    if (metas.find(m => m.label === 'unreachable')) {
      return {
        header: (
          <Kb.PopupHeaderText
            color={Kb.Styles.globalColors.white}
            backgroundColor={Kb.Styles.globalColors.red}
          >
            Your proof could not be found, and Keybase has stopped checking. How would you like to proceed?
          </Kb.PopupHeaderText>
        ),
        items: [
          {onClick: onShowProof, title: 'View proof'},
          {onClick: onRecheck, title: 'I fixed it - recheck'},
          onRevoke,
        ],
      }
    }

    if (metas.find(m => m.label === 'pending')) {
      let pendingMessage: undefined | string
      switch (type) {
        case 'hackernews':
          pendingMessage =
            'Your proof is pending. Hacker News caches its bios, so it might take a few hours before your proof gets verified.'
          break
        case 'dns':
          pendingMessage = 'Your proof is pending. DNS proofs can take a few hours to recognize.'
          break
      }
      return {
        header: pendingMessage ? (
          <Kb.PopupHeaderText
            color={Kb.Styles.globalColors.white}
            backgroundColor={Kb.Styles.globalColors.blue}
          >
            {pendingMessage}
          </Kb.PopupHeaderText>
        ) : null,
        items: [onRevoke],
      }
    }

    return {
      header: (
        <Kb.Box2
          direction="vertical"
          gap="tiny"
          centerChildren={true}
          style={styles.menuHeader}
          fullWidth={true}
        >
          <Kb.Box2 direction="vertical" style={styles.positionRelative}>
            <AssertionSiteIcon
              full={true}
              siteIconFullDarkmode={siteIconFullDarkmode}
              siteIconFull={siteIconFull}
              siteIconDarkmode={siteIconDarkmode}
              siteIcon={siteIcon}
              onCreateProof={onCreateProof}
              onShowProof={onShowProof}
              isSuggestion={isSuggestion}
            />
            <Kb.Icon type={stateToDecorationIcon(state)} style={styles.siteIconFullDecoration} />
          </Kb.Box2>
          {!!timestamp && (
            <>
              <Kb.Text type="BodySmall">Posted on</Kb.Text>
              <Kb.Text center={true} type="BodySmall">
                {formatTimeForAssertionPopup(timestamp)}
              </Kb.Text>
            </>
          )}
        </Kb.Box2>
      ),
      items: [{onClick: onShowProof, title: `View ${proofTypeToDesc(type)}`}, onRevoke],
    }
  }, [
    _onRevoke,
    isSuggestion,
    isYours,
    metas,
    onCreateProof,
    onRecheck,
    onShowProof,
    siteIcon,
    siteIconDarkmode,
    siteIconFull,
    siteIconFullDarkmode,
    state,
    stellarHidden,
    timestamp,
    type,
    onHideStellar,
  ])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return items ? (
        <Kb.FloatingMenu
          closeOnSelect={true}
          visible={true}
          onHidden={hidePopup}
          attachTo={attachTo}
          position="bottom right"
          containerStyle={styles.floatingMenu}
          header={header}
          items={items}
        />
      ) : null
    },
    [items, header]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  const tooltip = state === 'valid' || state === 'revoked' ? 'View proof' : undefined

  return (
    <Kb.Box2Measure
      className={notAUser ? undefined : 'hover-container'}
      ref={popupAnchor}
      direction="vertical"
      style={styles.container}
      fullWidth={true}
    >
      <Kb.Box2
        alignItems="flex-start"
        direction="horizontal"
        gap="tiny"
        fullWidth={true}
        gapStart={true}
        gapEnd={true}
      >
        <AssertionSiteIcon
          full={false}
          siteIconFullDarkmode={siteIconFullDarkmode}
          siteIconFull={siteIconFull}
          siteIconDarkmode={siteIconDarkmode}
          siteIcon={siteIcon}
          onCreateProof={onCreateProof}
          onShowProof={onShowProof}
          isSuggestion={isSuggestion}
        />
        <Kb.Text type="Body" style={styles.textContainer}>
          <Value {...p} />
          {!isSuggestion && (
            <Kb.Text type="Body" style={styles.site}>
              @{type}
            </Kb.Text>
          )}
        </Kb.Text>
        <Kb.ClickableBox onClick={items ? showPopup : onShowProof} style={styles.statusContainer}>
          <Kb.Box2Measure direction="horizontal" alignItems="center" gap="tiny" tooltip={tooltip}>
            <Kb.Icon
              type={stateToIcon(state)}
              fontSize={20}
              hoverColor={assertionColorToColor(color)}
              color={isSuggestion ? Kb.Styles.globalColors.black_20 : assertionColorToColor(color)}
            />
            {items ? (
              <>
                <Kb.Icon className="hover-visible" type="iconfont-caret-down" sizeType="Tiny" />
                {popup}
              </>
            ) : (
              <Kb.Box2 direction="vertical" />
            )}
          </Kb.Box2Measure>
        </Kb.ClickableBox>
      </Kb.Box2>
      {!!metas.length && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.metaContainer}>
          {metas.map(m => (
            <Kb.Meta key={m.label} backgroundColor={assertionColorToColor(m.color)} title={m.label} />
          ))}
        </Kb.Box2>
      )}
    </Kb.Box2Measure>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {flexShrink: 0, paddingBottom: 4, paddingTop: 4},
      crypto: Kb.Styles.platformStyles({
        isElectron: {display: 'inline-block', fontSize: 11, wordBreak: 'break-all'},
      }),
      floatingMenu: {
        maxWidth: 240,
        minWidth: 196,
      },
      halfOpacity: Kb.Styles.platformStyles({
        isMobile: {opacity: 0.5}, // desktop is handled by emotion
      }),
      menuHeader: {
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        padding: Kb.Styles.globalMargins.small,
      },
      metaContainer: {flexShrink: 0, paddingLeft: 20 + Kb.Styles.globalMargins.tiny * 2 - 4}, // icon spacing plus meta has 2 padding for some reason
      positionRelative: {position: 'relative'},
      site: {color: Kb.Styles.globalColors.black_20},
      siteIconFullDecoration: {bottom: -8, position: 'absolute', right: -10},
      statusContainer: Kb.Styles.platformStyles({
        isMobile: {position: 'relative', top: -2},
      }),
      strikeThrough: {textDecorationLine: 'line-through'},
      textContainer: Kb.Styles.platformStyles({
        common: {flexGrow: 1, flexShrink: 1, marginTop: -1},
        isMobile: {backgroundColor: Kb.Styles.globalColors.fastBlank},
      }),
      tooltip: Kb.Styles.platformStyles({isElectron: {display: 'inline-flex'}}),
      username: Kb.Styles.platformStyles({
        common: {letterSpacing: 0.2},
        isElectron: {wordBreak: 'break-all'},
      }),
    }) as const
)

export default Assertion
