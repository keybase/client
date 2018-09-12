// @flow
import * as React from 'react'
import {toUpper, upperFirst} from 'lodash-es'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

const sendIcon = Styles.isMobile
  ? 'icon-fancy-stellar-sending-mobile-149-129'
  : 'icon-fancy-stellar-sending-desktop-98-86'
const receiveIcon = Styles.isMobile
  ? 'icon-fancy-stellar-receiving-mobile-149-129'
  : 'icon-fancy-stellar-receiving-desktop-98-86'

const iconHeight = Styles.isMobile ? 129 : 86

type HeaderProps = {|
  amountNominal: string,
  balanceChange: string, // may be empty
  balanceChangeColor: string,
  bottomLine: string, // may be empty
  icon: 'sending' | 'receiving',
  loading: boolean,
  sender: string,
  senderDeviceName: string,
  timestamp: string,
  topLine: string,
  txVerb: 'sent' | 'requested',
|}

type Props = {|
  ...HeaderProps,
  attachTo?: ?React.Component<any, any>,
  onCancel: ?() => void, // if falsy tx is not cancelable
  onHidden: () => void,
  position: Position,
  visible: boolean,
|}

const Header = (props: HeaderProps) =>
  props.loading ? (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.loadingHeaderTop}>
        <Kb.ProgressIndicator white={true} style={styles.loadingIndicator} />
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 fullWidth={true} gap="small" gapEnd={true} direction="vertical">
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerTop}>
        <Kb.Icon
          type={props.icon === 'sending' ? sendIcon : receiveIcon}
          style={Kb.iconCastPlatformStyles(styles.icon)}
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
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
        <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} centerChildren={true}>
          <Kb.Text type="BodyTiny">{upperFirst(props.txVerb)} by</Kb.Text>
          <Kb.Avatar size={16} username={props.sender} clickToProfile="tracker" />
          <Kb.ConnectedUsernames
            onUsernameClicked="profile"
            colorFollowing={true}
            colorYou={true}
            inline={true}
            usernames={[props.sender]}
            type="BodyTinySemibold"
          />
        </Kb.Box2>
        <Kb.Text type="BodyTiny">using device {props.senderDeviceName}</Kb.Text>
        <Kb.Text type="BodyTiny">{props.timestamp}</Kb.Text>
      </Kb.Box2>
      {!!props.balanceChange && (
        <Kb.Text
          type="BodyExtrabold"
          style={Styles.collapseStyles([styles.textAlignCenter, {color: props.balanceChangeColor}])}
        >
          {props.balanceChange}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

const PaymentPopup = (props: Props) => {
  const items =
    !props.loading && props.onCancel
      ? [
          {
            danger: true,
            onClick: props.onCancel,
            title: 'Cancel request',
          },
        ]
      : []

  // separate out header props
  const {attachTo, onCancel, onHidden, position, visible, ...headerProps} = props
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
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position={props.position}
      header={header}
      items={items}
      visible={props.visible}
    />
  )
}

const styles = Styles.styleSheetCreate({
  colorWhite: {
    color: Styles.globalColors.white,
  },
  headerTop: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.purple,
      paddingBottom: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingTop: iconHeight - 6,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      position: 'absolute',
      top: -12,
    },
    isMobile: {
      marginBottom: 6,
      marginTop: -15,
    },
    isAndroid: {
      marginTop: Styles.globalMargins.tiny,
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
  textAlignCenter: {
    textAlign: 'center',
  },
})

export default PaymentPopup
