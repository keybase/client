// @flow
import * as React from 'react'
import {toUpper, upperFirst} from 'lodash-es'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc.types'

const sendIcon = Styles.isMobile
  ? 'icon-fancy-stellar-sending-mobile-149-129'
  : 'icon-fancy-stellar-sending-desktop-98-86'
const receiveIcon = Styles.isMobile
  ? 'icon-fancy-stellar-receiving-mobile-149-129'
  : 'icon-fancy-stellar-receiving-desktop-98-86'

const headerIconHeight = Styles.isMobile ? 129 : 86

type HeaderProps = {|
  amountNominal: string,
  approxWorth: string,
  balanceChange: string, // may be empty
  balanceChangeColor: string,
  bottomLine: string, // may be empty
  errorDetails?: string,
  icon: 'sending' | 'receiving',
  loading: boolean,
  sender: string,
  senderDeviceName: string,
  status: string,
  timestamp: string,
  topLine: string,
  txVerb: 'sent' | 'requested',
|}

type Props = {|
  ...HeaderProps,
  attachTo?: () => ?React.Component<any>,
  cancelButtonLabel: string,
  onCancel: ?() => void, // if falsy tx is not cancelable
  onClaimLumens: ?() => void, // if falsy disclaimer has already been accepted
  onHidden: () => void,
  onSeeDetails: ?() => void, // if falsy this doesn't have a details page
  position: Position,
  style?: Styles.StylesCrossPlatform,
  visible: boolean,
|}

const Header = (props: HeaderProps) =>
  props.loading ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.popupContainer}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.loadingHeaderTop}>
        <Kb.ProgressIndicator white={true} style={styles.loadingIndicator} />
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 fullWidth={true} gap="small" gapEnd={true} direction="vertical" style={styles.popupContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerTop}>
        <Kb.Icon
          type={props.icon === 'sending' ? sendIcon : receiveIcon}
          style={Kb.iconCastPlatformStyles(styles.headerIcon)}
        />
        <Kb.Text type="BodyTiny" style={styles.colorWhite}>
          {toUpper(props.topLine)}
        </Kb.Text>
        <Kb.Text type="HeaderExtrabold" style={styles.colorWhite}>
          {props.amountNominal}
        </Kb.Text>
        {!!props.bottomLine && (
          <Kb.Text type="BodyTiny" style={styles.colorWhite}>
            {toUpper(props.bottomLine)}
          </Kb.Text>
        )}
        {!!props.approxWorth && (
          <Kb.Text type="BodyTiny" style={styles.colorWhite}>
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
          <Kb.Avatar size={16} username={props.sender} clickToProfile="tracker" />
          <Kb.ConnectedUsernames
            onUsernameClicked="profile"
            colorFollowing={true}
            colorYou={true}
            inline={true}
            usernames={[props.sender]}
            type="BodySmallSemibold"
          />
        </Kb.Box2>
        <Kb.Text type="BodySmall">using device {props.senderDeviceName}</Kb.Text>
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
  colorWhite: {color: Styles.globalColors.white},
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
  headerTop: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.purple,
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  loadingHeaderTop: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purple,
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
  popupContainer: Styles.platformStyles({
    isElectron: {maxWidth: 240, minWidth: 200},
  }),
})

export default PaymentPopup
