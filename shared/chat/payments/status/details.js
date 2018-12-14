// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatTimeForMessages} from '../../../util/timestamp'

type Props = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  sender: string,
  worthDescription: string,
  amountDescription: string,
  sendTime: number,
  isYou: boolean,
  visible: boolean,
  delta: 'none' | 'increase' | 'decrease',
}

const PaymentStatusDetailsHeader = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.worthContainer}>
        <Kb.Icon
          type={
            Styles.isMobile
              ? 'icon-fancy-stellar-sending-mobile-149-129'
              : 'icon-fancy-stellar-sending-desktop-98-86'
          }
          style={styles.icon}
        />
        <Kb.Text type="Body" style={styles.worthText}>
          YOU SENT LUMENS WORTH
        </Kb.Text>
        <Kb.Text type="HeaderBigExtrabold" style={styles.worthText}>
          {props.worthDescription}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="xsmall" style={styles.bottomContainer}>
        <Kb.Box2 direction="vertical" gap="xtiny" style={styles.senderContainer}>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.nameContainer}>
            <Kb.Text type="BodySmall">Sent by</Kb.Text>
            <Kb.NameWithIcon
              avatarSize={16}
              style={styles.sender}
              horizontal={true}
              username={props.sender}
            />
          </Kb.Box2>
          <Kb.Text type="BodySmall">{formatTimeForMessages(props.sendTime)}</Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodyExtrabold" style={styles[props.delta + 'Amount']}>
          {props.amountDescription}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const PaymentStatusDetails = (props: Props) => {
  const header = {
    style: {
      paddingBottom: 0,
      paddingTop: 24,
    },
    title: 'header',
    view: <PaymentStatusDetailsHeader {...props} />,
  }
  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={[]}
      onHidden={props.onHidden}
      visible={props.visible}
    />
  )
}

const styles = Styles.styleSheetCreate({
  noneAmount: {
    color: Styles.globalColors.black,
  },
  increaseAmount: {
    color: Styles.globalColors.green,
  },
  decreaseAmount: {
    color: Styles.globalColors.red,
  },
  bottomContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      paddingTop: Styles.globalMargins.small,
      paddingBottom: Styles.globalMargins.small,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.small,
    },
  }),
  nameContainer: {
    alignItems: 'center',
  },
  senderContainer: {
    alignItems: 'center',
  },
  worthContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.purple,
      paddingBottom: Styles.globalMargins.tiny,
    },
  }),
  worthText: {
    color: Styles.globalColors.white,
  },
})

export default PaymentStatusDetails
