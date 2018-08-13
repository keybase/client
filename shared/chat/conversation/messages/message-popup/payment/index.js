// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as S from '../../../../../styles'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type HeaderProps = {|
  amountNominal: string,
  balanceChange: string, // may be empty
  balanceChangeColor: string,
  bottomLine: string, // may be empty
  icon: Kb.IconType,
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

const Header = (props: HeaderProps) => (
  <Kb.Box2 fullWidth={true} gap="small" gapEnd={true} direction="vertical">
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerTop}>
      <Kb.Icon type={props.icon} style={Kb.iconCastPlatformStyles(styles.icon)} />
      <Kb.Text type="Body" style={styles.colorWhite}>
        {props.topLine}
      </Kb.Text>
      <Kb.Text type="HeaderExtrabold" style={styles.colorWhite}>
        {props.amountNominal}
      </Kb.Text>
      {props.bottomLine && (
        <Kb.Text type="Body" style={styles.colorWhite}>
          {props.bottomLine}
        </Kb.Text>
      )}
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
      <Kb.Text type="BodyTiny">
        {props.txVerb} by{' '}
        <Kb.ConnectedUsernames
          clickable={true}
          colorFollowing={true}
          inline={true}
          usernames={[props.sender]}
          type="BodyTiny"
        />
      </Kb.Text>
      <Kb.Text type="BodyTiny">using device {props.senderDeviceName}</Kb.Text>
      <Kb.Text type="BodyTiny">{props.timestamp}</Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const PaymentPopup = (props: Props) => {
  const header = {title: 'header', view: <Header {...props} />}
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position={props.position}
      header={header}
      items={[]}
      visible={props.visible}
    />
  )
}

const styles = S.styleSheetCreate({
  colorWhite: {
    color: S.globalColors.white,
  },
  headerTop: {
    alignItems: 'center',
    backgroundColor: S.globalColors.purple,
    paddingBottom: S.globalMargins.tiny,
  },
  icon: {
    marginTop: -15,
  },
})

export default PaymentPopup
