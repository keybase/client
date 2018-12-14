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
}

const PaymentStatusDetailsHeader = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="vertical">
        <Kb.Icon
          type={
            Styles.isMobile
              ? 'icon-fancy-stellar-sending-mobile-149-129'
              : 'icon-fancy-stellar-sending-desktop-98-86'
          }
          style={styles.icon}
        />
        <Kb.Text type="Body">YOU SENT LUMENS WORTH</Kb.Text>
        <Kb.Text type="HeaderBigExtrabold">{props.worthDescription}</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmall">
            Sent by <Kb.NameWithIcon horizontal={true} username={props.sender} />
          </Kb.Text>
          <Kb.Text type="BodySmall">{formatTimeForMessages(props.sendTime)}</Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodyExtrabold">{props.amountDescription}</Kb.Text>
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
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.small,
      marginTop: 35,
    },
  }),
})

export default PaymentStatusDetails
