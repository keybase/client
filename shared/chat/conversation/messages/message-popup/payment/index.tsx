import * as React from 'react'
import {toUpper, upperFirst} from 'lodash-es'
import * as Styles from '../../../../../styles'

import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {Box2} from '../../../../../common-adapters/box'
import Text, {AllowedColors} from '../../../../../common-adapters/text'
import Icon, {castPlatformStyles as iconCastPlatformStyles} from '../../../../../common-adapters/icon'
import Avatar from '../../../../../common-adapters/avatar'
import ConnectedUsernames from '../../../../../common-adapters/usernames/container'
import ProgressIndicator from '../../../../../common-adapters/progress-indicator'
import Divider from '../../../../../common-adapters/divider'
import FloatingMenu from '../../../../../common-adapters/floating-menu'

// This is actually a dependency of common-adapters/markdown so we have to treat it like a common-adapter, no * import allowed
// TODO could make this more dynamic to avoid this (aka register with markdown what custom stuff you want)
const Kb = {
  Avatar,
  Box2,
  ConnectedUsernames,
  Divider,
  FloatingMenu,
  Icon,
  ProgressIndicator,
  Text,
  iconCastPlatformStyles,
}

const sendIcon = Styles.isMobile
  ? 'icon-fancy-stellar-sending-mobile-149-129'
  : 'icon-fancy-stellar-sending-desktop-98-86'
const receiveIcon = Styles.isMobile
  ? 'icon-fancy-stellar-receiving-mobile-149-129'
  : 'icon-fancy-stellar-receiving-desktop-98-86'

const headerIconHeight = Styles.isMobile ? 129 : 86
const pendingIconSize = 40

type HeaderProps = {
  amountNominal: string
  approxWorth: string
  balanceChange: string
  balanceChangeColor?: AllowedColors
  bottomLine: string
  errorDetails: string
  icon: 'sending' | 'receiving'
  loading: boolean
  sender: string
  senderDeviceName: string
  status: string
  timestamp: string
  topLine: string
  txVerb: 'sent' | 'requested'
}

export type Props = {
  attachTo?: () => React.Component<any> | null
  cancelButtonLabel: string
  onCancel: (() => void) | null
  onClaimLumens: (() => void) | null
  onHidden: () => void
  onSeeDetails: (() => void) | null
  position: Position
  style?: Styles.StylesCrossPlatform
  visible: boolean
} & HeaderProps

const headerIcon = (props: HeaderProps) =>
  props.status === 'pending' ? (
    <Kb.Icon
      type="iconfont-time"
      color={Styles.globalColors.black_50}
      fontSize={pendingIconSize}
      style={Kb.iconCastPlatformStyles(styles.pendingHeaderIcon)}
    />
  ) : (
    <Kb.Icon
      type={props.icon === 'sending' ? sendIcon : receiveIcon}
      style={Kb.iconCastPlatformStyles(styles.headerIcon)}
    />
  )

const Header = (props: HeaderProps) =>
  props.loading ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.popupContainer}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.loadingHeaderTop}>
        <Kb.ProgressIndicator white={true} style={styles.loadingIndicator} />
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 fullWidth={true} gap="small" gapEnd={true} direction="vertical" style={styles.popupContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={headerTop(props)}>
        {headerIcon(props)}
        <Kb.Text type="BodyTiny" style={headerTextStyle(props)}>
          {toUpper(props.topLine)}
        </Kb.Text>
        <Kb.Text type="HeaderExtrabold" style={headerTextStyle(props)}>
          {props.amountNominal}
        </Kb.Text>
        {!!props.bottomLine && (
          <Kb.Text type="BodyTiny" style={headerTextStyle(props)}>
            {toUpper(props.bottomLine)}
          </Kb.Text>
        )}
        {!!props.approxWorth && (
          <Kb.Text type="BodyTiny" style={headerTextStyle(props)}>
            (APPROXIMATELY {props.approxWorth})
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        centerChildren={true}
        style={styles.messageInfoContainer}
      >
        <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} centerChildren={true}>
          <Kb.Text type="BodySmall">{upperFirst(props.txVerb)} by</Kb.Text>
          <Kb.Avatar size={16} username={props.sender} onClick="profile" />
          <Kb.ConnectedUsernames
            onUsernameClicked="profile"
            colorFollowing={true}
            colorYou={true}
            inline={true}
            usernames={[props.sender]}
            type="BodySmallSemibold"
          />
        </Kb.Box2>
        <Kb.Text type="BodySmall" center={true}>
          using device {props.senderDeviceName}
        </Kb.Text>
        <Kb.Text type="BodySmall">{props.timestamp}</Kb.Text>
      </Kb.Box2>
      {!!props.status && (
        <Kb.Text center={true} type="BodySmall">
          {toUpper(props.status)}
        </Kb.Text>
      )}
      {!!props.balanceChange && (
        <Kb.Text center={true} type="BodyExtrabold" style={{color: props.balanceChangeColor}}>
          {props.balanceChange}
        </Kb.Text>
      )}
      {!!props.errorDetails && (
        <Kb.Box2 direction="horizontal" style={styles.errorDetails}>
          <Kb.Text center={true} type="BodySmall">
            {props.errorDetails}
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

const PaymentPopup = (props: Props) => {
  const items = !props.loading
    ? [
        ...(props.onCancel
          ? [
              {
                danger: true,
                onClick: props.onCancel,
                title: props.cancelButtonLabel,
              },
            ]
          : []),
        ...(props.onSeeDetails
          ? [
              {
                onClick: props.onSeeDetails,
                title: 'See transaction details',
              },
            ]
          : []),
        ...(props.onClaimLumens ? [{onClick: props.onClaimLumens, title: 'Claim lumens'}] : []),
      ]
    : []

  // separate out header props
  const {
    attachTo,
    cancelButtonLabel,
    onCancel,
    onClaimLumens,
    onHidden,
    onSeeDetails,
    position,
    style,
    visible,
    ...headerProps
  } = props
  const header = {
    title: 'header',
    view: (
      <React.Fragment>
        <Header {...headerProps} />
        {!!items.length && <Kb.Divider />}
      </React.Fragment>
    ),
  }
  return (
    <Kb.FloatingMenu
      closeOnSelect={true}
      containerStyle={style}
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position={props.position}
      positionFallbacks={[]}
      header={header}
      items={items}
      visible={props.visible}
    />
  )
}

const styles = Styles.styleSheetCreate({
  errorDetails: {
    maxWidth: 200,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  headerIcon: Styles.platformStyles({
    common: {height: headerIconHeight},
    isAndroid: {
      marginTop: Styles.globalMargins.tiny,
    },
    isElectron: {marginBottom: Styles.globalMargins.small},
    isMobile: {
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
  }),
  headerTextNotPending: {color: Styles.globalColors.white},
  headerTextPending: {color: Styles.globalColors.black_50},
  headerTop: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.purpleDark,
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  loadingHeaderTop: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purpleDark,
    },
    isElectron: {
      height: 133,
    },
    isMobile: {
      height: 215,
    },
  }),
  loadingIndicator: {
    height: 80,
    width: 80,
  },
  messageInfoContainer: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  pendingHeaderIcon: Styles.platformStyles({
    common: {height: pendingIconSize},
    isAndroid: {
      marginTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      display: 'inline-block',
      marginBottom: Styles.globalMargins.small,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
  }),
  pendingHeaderTop: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.black_05,
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  popupContainer: Styles.platformStyles({
    isElectron: {maxWidth: 240, minWidth: 200},
  }),
})

const headerTop = (props: HeaderProps) => {
  return props.status === 'pending' ? styles.pendingHeaderTop : styles.headerTop
}

const headerTextStyle = (props: HeaderProps) => {
  return props.status === 'pending' ? styles.headerTextPending : styles.headerTextNotPending
}

export default PaymentPopup
