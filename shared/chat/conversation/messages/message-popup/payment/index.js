// @flow
import * as React from 'react'
import {toUpper, upperFirst} from 'lodash-es'
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
      <Kb.Text type="BodyTiny" style={styles.colorWhite}>
        {toUpper(props.topLine)}
      </Kb.Text>
      <Kb.Text type="HeaderExtrabold" style={styles.colorWhite}>
        {props.amountNominal}
      </Kb.Text>
      {props.bottomLine && (
        <Kb.Text type="BodyTiny" style={styles.colorWhite}>
          {toUpper(props.bottomLine)}
        </Kb.Text>
      )}
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
      <Kb.Text type="BodyTiny">
        {upperFirst(props.txVerb)} by{' '}
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
    {!!props.balanceChange && (
      <Kb.Text
        type="BodyExtrabold"
        style={S.collapseStyles([styles.textAlignCenter, {color: props.balanceChangeColor}])}
      >
        {props.balanceChange}
      </Kb.Text>
    )}
  </Kb.Box2>
)

const PaymentPopup = (props: Props) => {
  const items = props.onCancel
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
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position={props.position}
      header={header}
      items={items}
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
    marginBottom: 6,
    marginTop: -15,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
})

export default PaymentPopup
