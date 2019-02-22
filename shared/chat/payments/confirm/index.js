// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type LoadingProps = {||}

const PaymentsConfirmLoading = (props: LoadingProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
      <Kb.ProgressIndicator />
    </Kb.Box2>
  </Kb.Box2>
)

type ErrorProps = {|
  error: string,
  onCancel: () => void,
  onWallet: () => void,
|}

const _PaymentsConfirmError = (props: ErrorProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      fullHeight={true}
      style={styles.fullErrorContainer}
    >
      <Kb.Text type="BodyExtrabold" style={styles.errorText}>
        {props.error}
      </Kb.Text>
      <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
        <Kb.Button type="Secondary" onClick={props.onCancel} style={styles.cancelButton} label="Cancel" />
        <Kb.Button
          style={styles.submitButton}
          type="Primary"
          onClick={props.onWallet}
          label={'Set up wallet'}
        />
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)

const PaymentsConfirmError = Kb.HeaderOnMobile(_PaymentsConfirmError)

type PaymentProps = {
  +displayAmount?: ?string,
  +error?: ?string,
  +fullName: string,
  +username: string,
  +xlmAmount: string,
}

const PaymentRow = (props: PaymentProps) => (
  <React.Fragment>
    <Kb.NameWithIcon horizontal={true} username={props.username} metaOne={props.fullName} />
    <Kb.Box2 direction="vertical" style={styles.paymentTotalsContainer}>
      {!!props.displayAmount && <Kb.Text type="BodyExtrabold">{props.displayAmount}</Kb.Text>}
      {props.error ? (
        <Kb.Text type="BodySmallSemibold" style={styles.errorText}>
          ERROR WILL NOT SEND
        </Kb.Text>
      ) : (
        <Kb.Text type={props.displayAmount ? 'BodySmallSemibold' : 'BodyExtrabold'}>
          {props.xlmAmount}
        </Kb.Text>
      )}
    </Kb.Box2>
  </React.Fragment>
)

type Props = {|
  displayTotal: string,
  error?: string,
  loading: boolean,
  onAccept: () => void,
  onCancel: () => void,
  onWallet: () => void,
  payments: Array<PaymentProps>,
  xlmTotal: string,
|}

const PaymentsConfirm = (props: Props) => (
  <Kb.MaybePopup onClose={props.onCancel}>
    {props.loading ? (
      <PaymentsConfirmLoading />
    ) : props.error ? (
      <PaymentsConfirmError error={props.error} onCancel={props.onCancel} onWallet={props.onWallet} />
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
          <Kb.Text type="BodyTiny" style={styles.headerText}>
            SENDING
          </Kb.Text>
          <Kb.Text type="HeaderBigExtrabold" style={styles.xlmTotal}>
            {props.xlmTotal}
          </Kb.Text>
          <Kb.Text type="BodyTiny" style={styles.headerText}>
            (APPROXIMATELY {props.displayTotal})
          </Kb.Text>
        </Kb.Box2>
        <Kb.ScrollView style={styles.paymentsContainer}>
          {props.payments.map(p => (
            <Kb.Box2 key={p.username} direction="horizontal" fullWidth={true} style={styles.paymentContainer}>
              <PaymentRow {...p} />
            </Kb.Box2>
          ))}
        </Kb.ScrollView>
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button type="Secondary" onClick={props.onCancel} style={styles.cancelButton} label="Cancel" />
          <Kb.WaitingButton
            style={styles.submitButton}
            type="PrimaryGreen"
            onClick={props.onAccept}
            waitingKey={null}
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
  buttonBar: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  buttonContainer: Styles.platformStyles({
    common: {
      justifyContent: 'space-between',
    },
  }),
  cancelButton: Styles.platformStyles({
    isElectron: {
      height: Styles.globalMargins.large,
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
  errorClose: {
    padding: Styles.globalMargins.tiny,
  },
  errorText: {
    color: Styles.globalColors.red,
  },
  fullErrorContainer: Styles.platformStyles({
    isElectron: {
      padding: 20,
    },
  }),
  headerText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.small,
      marginTop: 35,
    },
  }),
  paymentContainer: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.lightGrey,
      borderStyle: 'solid',
      borderWidth: 1,
      justifyContent: 'space-between',
      padding: Styles.globalMargins.tiny,
    },
    isElectron: {
      marginBottom: -1,
    },
  }),
  paymentTotalsContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
    },
  }),
  paymentsContainer: Styles.platformStyles({
    isElectron: {
      height: 150,
    },
  }),
  submitButton: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      height: Styles.globalMargins.large,
    },
  }),
  submitIcon: Styles.platformStyles({
    isElectron: {
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  totalContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.purple,
      paddingBottom: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingBottom: 50,
    },
  }),
  xlmTotal: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
    },
  }),
})

export default PaymentsConfirm
