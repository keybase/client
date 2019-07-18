import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import ConfirmForm from '../../../wallets/confirm-form'

type LoadingProps = {}

const PaymentsConfirmLoading = Kb.HeaderOrPopup((_: LoadingProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
      <Kb.ProgressIndicator />
    </Kb.Box2>
  </Kb.Box2>
))

type ErrorProps = {
  error: string
  errorIsNoWallet: boolean
  onCancel: () => void
  onWallet: () => void
}

const _PaymentsConfirmError = (props: ErrorProps) => {
  if (props.errorIsNoWallet) {
    return _PaymentsConfirmErrorNoWallet(props)
  } else {
    return _PaymentsConfirmErrorMisc(props)
  }
}

const _PaymentsConfirmErrorMisc = (props: ErrorProps) => (
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
    </Kb.Box2>
  </Kb.Box2>
)

const _PaymentsConfirmErrorNoWallet = (props: ErrorProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      fullHeight={true}
      style={styles.fullErrorContainer}
    >
      <Kb.Box2 direction="vertical" style={styles.pushDown} fullWidth={true} centerChildren={true}>
        <Kb.Text type="BodyExtrabold">{props.error}</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.pushDown} fullWidth={true}>
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button type="Dim" onClick={props.onCancel} style={styles.cancelButton} label="Cancel" />
          <Kb.Button style={styles.submitButton} onClick={props.onWallet} label="Set up wallet" />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const PaymentsConfirmError = Kb.HeaderOrPopup(_PaymentsConfirmError)

type PaymentProps = {
  readonly displayAmount?: string | null
  readonly error?: string | null
  readonly fullName: string
  readonly username: string
  readonly xlmAmount: string
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

type Props = {
  displayTotal: string
  error?: string
  errorIsNoWallet?: boolean
  loading: boolean
  onAccept: () => void
  onCancel: () => void
  onWallet: () => void
  payments: Array<PaymentProps>
  xlmTotal: string
}

const PaymentsConfirm = (props: Props) => {
  if (props.loading) {
    return <PaymentsConfirmLoading />
  }
  if (props.error) {
    return (
      <PaymentsConfirmError
        error={props.error}
        errorIsNoWallet={props.errorIsNoWallet || false}
        onCancel={props.onCancel}
        onWallet={props.onWallet}
      />
    )
  }
  return (
    <ConfirmForm
      onClose={props.onCancel}
      onSendClick={props.onAccept}
      onBack={props.onCancel}
      showCancelInsteadOfBackOnMobile={true}
      participantsComp={() => (
        <>
          {props.payments.map(p => (
            <Kb.Box2 key={p.username} direction="horizontal" fullWidth={true} style={styles.paymentContainer}>
              <PaymentRow {...p} />
            </Kb.Box2>
          ))}
        </>
      )}
      sendFailed={false}
      waitingKey=""
      sendingIntentionXLM={true}
      displayAmountXLM={props.xlmTotal}
      displayAmountFiat={props.displayTotal}
      readyToSend="enabled"
    />
  )
}

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
      height: 560,
      width: 400,
    },
  }),
  errorClose: {
    padding: Styles.globalMargins.tiny,
  },
  errorText: {
    color: Styles.globalColors.redDark,
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
      borderColor: Styles.globalColors.greyLight,
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
  pushDown: Styles.platformStyles({
    isElectron: {flex: 1, justifyContent: 'flex-end'},
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
      backgroundColor: Styles.globalColors.purpleDark,
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
