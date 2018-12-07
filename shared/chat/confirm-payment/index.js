// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type PaymentProps = {|
  displayAmount?: string,
  error?: string,
  fullName: string,
  username: string,
  xlmAmount: string,
|}

type Props = {|
  displayTotal: string,
  loading: boolean,
  onAccept: () => void,
  onCancel: () => void,
  payments: Array<PaymentProps>,
  xlmTotal: string,
|}

const PaymentsConfirm = (props: Props) => (
  <Kb.MaybePopup onClose={props.onCancel}>
    {props.loading ? (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
          <Kb.ProgressIndicator />
        </Kb.Box2>
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.totalContainer}>
          <Kb.Icon
            type={
              Styles.isMobile
                ? 'icon-fancy-stellar-sending-mobile-149-129'
                : 'icon-fancy-stellar-sending-desktop-98-86'
            }
            style={styles.icon}
          />
          <Kb.Text type="Body" style={styles.headerText}>
            SENDING
          </Kb.Text>
          <Kb.Text type="HeaderExtrabold" style={styles.xlmTotal}>
            {props.xlmTotal}
          </Kb.Text>
          <Kb.Text type="Body" style={styles.headerText}>
            (APPROXIMATELY {props.displayTotal})
          </Kb.Text>
        </Kb.Box2>
        <Kb.ScrollView style={styles.paymentsContainer}>
          {props.payments.map(p => (
            <Kb.Box2 key={p.username} direction="horizontal" fullWidth={true} style={styles.paymentContainer}>
              <Kb.NameWithIcon horizontal={true} username={p.username} metaOne={p.fullName} />
              <Kb.Box2 direction="vertical" style={styles.paymentTotalsContainer}>
                {!!p.displayAmount && <Kb.Text type="BodyExtrabold">{p.displayAmount}</Kb.Text>}
                <Kb.Text type={p.displayAmount ? 'BodySmallSemibold' : 'BodyExtrabold'}>
                  {p.xlmAmount}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
          ))}
        </Kb.ScrollView>
        <Kb.ButtonBar align="center" direction="row" fullWidth={true}>
          <Kb.Button type="Secondary" onClick={props.onCancel} style={styles.cancelButton} label="Cancel" />
          <Kb.Button
            style={styles.submitButton}
            type="PrimaryGreen"
            onClick={props.onAccept}
            children={
              <Kb.Icon
                color={Styles.globalColors.white}
                style={Kb.iconCastPlatformStyles(styles.submitIcon)}
                type="iconfont-stellar-send"
              />
            }
            label={'Send ' + props.xlmTotal}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    )}
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  buttonContainer: Styles.platformStyles({
    isElectron: {
      justifyContent: 'space-between',
    },
  }),
  cancelButton: Styles.platformStyles({
    isElectron: {
      height: 40,
    },
  }),
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      height: 458,
      width: 360,
    },
  }),
  headerText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      fontSize: 11,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: 16,
      marginTop: 35,
    },
  }),
  paymentContainer: Styles.platformStyles({
    isElectron: {
      borderColor: Styles.globalColors.lightGrey,
      borderStyle: 'solid',
      borderWidth: 1,
      justifyContent: 'space-between',
      margin: -1,
      padding: Styles.globalMargins.tiny,
    },
  }),
  paymentTotalsContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
    },
  }),
  paymentsContainer: Styles.platformStyles({
    isElectron: {
      minHeight: 150,
    },
  }),
  submitButton: Styles.platformStyles({
    isElectron: {
      height: 40,
      minWidth: 225,
    },
  }),
  submitIcon: Styles.platformStyles({
    isElectron: {
      paddingRight: 8,
    },
  }),
  totalContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.purple,
    },
    isElectron: {
      height: 242,
    },
  }),
  xlmTotal: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      fontSize: 24,
      lineHeight: 28,
    },
  }),
})

export default PaymentsConfirm
