import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletBackButton} from '../common'

type LoadingProps = {}

type HeaderProps = {
  onBack: () => void
  sendingIntentionXLM: boolean
  displayAmountXLM: string
  displayAmountFiat: string
}

const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.headerContent}>
      <Kb.Icon
        type={
          Styles.isMobile
            ? 'icon-fancy-stellar-sending-mobile-149-129'
            : 'icon-fancy-stellar-sending-desktop-98-86'
        }
        style={Kb.iconCastPlatformStyles(styles.headerIcon)}
      />
      <Kb.Text selectable={true} type="BodyTiny" style={styles.headerText}>
        {(props.sendingIntentionXLM ? 'Sending' : 'Sending Lumens worth').toUpperCase()}
      </Kb.Text>
      <Kb.Text selectable={true} type="HeaderBigExtrabold" style={styles.headerText}>
        {props.sendingIntentionXLM ? props.displayAmountXLM : props.displayAmountFiat}
      </Kb.Text>
      {props.sendingIntentionXLM && !!props.displayAmountFiat && (
        <Kb.Text selectable={true} type="BodyTiny" style={styles.headerText}>
          {'(APPROXIMATELY ' + props.displayAmountFiat + ')'}
        </Kb.Text>
      )}
    </Kb.Box2>
    <WalletBackButton onBack={props.onBack} />
  </Kb.Box2>
)

const PaymentsConfirmLoading = Kb.HeaderOrPopup((props: LoadingProps) => (
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

type NoteAndMemoProps = {
  encryptedNote?: string
  publicMemo?: string
}

const NoteAndMemo = (props: NoteAndMemoProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {!!props.encryptedNote && (
      <React.Fragment>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Encrypted note
          </Kb.Text>
          <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
            {props.encryptedNote}
          </Kb.Text>
        </Kb.Box2>
      </React.Fragment>
    )}
    {!!props.publicMemo && (
      <React.Fragment>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Public note
          </Kb.Text>
          <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
            {props.publicMemo}
          </Kb.Text>
        </Kb.Box2>
      </React.Fragment>
    )}
  </Kb.Box2>
)

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
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" fullHeight={!Styles.isMobile} fullWidth={true} style={styles.container}>
        <Header
          onBack={props.onBack}
          sendingIntentionXLM={props.sendingIntentionXLM}
          displayAmountXLM={props.displayAmountXLM}
          displayAmountFiat={props.displayAmountFiat}
        />
        <Kb.ScrollView style={styles.scrollView} alwaysBounceVertical={false}>
          {(!!props.encryptedNote || !!props.publicMemo) && (
            <NoteAndMemo encryptedNote={props.encryptedNote} publicMemo={props.publicMemo} />
          )}
        </Kb.ScrollView>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          gap="small"
          style={styles.buttonContainer}
        >
          {props.readyToSend === 'spinning' ? (
            <Kb.Button type="Success" fullWidth={true} style={styles.button} waiting={true} />
          ) : (
            <Kb.WaitingButton
              type="Success"
              disabled={props.sendFailed || props.readyToSend === 'disabled'}
              onClick={props.onSendClick}
              waitingKey={props.waitingKey}
              fullWidth={true}
              style={styles.button}
              children={
                <React.Fragment>
                  <Kb.Icon
                    type="iconfont-stellar-send"
                    style={Kb.iconCastPlatformStyles(styles.buttonIcon)}
                    color={Styles.globalColors.white}
                  />
                  <Kb.Text type="BodyBig" style={styles.buttonText}>
                    Send{' '}
                    <Kb.Text type="BodyBigExtrabold" style={styles.buttonText}>
                      {props.displayAmountXLM}
                    </Kb.Text>
                  </Kb.Text>
                </React.Fragment>
              }
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.SafeAreaView />
    </Kb.MaybePopup>
  )
}

const styles = Styles.styleSheetCreate({
  bodyText: Styles.platformStyles({
    common: {color: Styles.globalColors.black},
    isElectron: {wordBreak: 'break-word'},
  }),
  headingText: {
    color: Styles.globalColors.blue,
    marginBottom: Styles.globalMargins.xtiny,
  },
  memoContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  buttonBar: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  buttonContainer: Styles.platformStyles({
    common: {
      ...Styles.padding(0, Styles.globalMargins.small),
      alignSelf: 'flex-end',
      flexShrink: 0,
      justifyContent: 'space-between',
    },
    isElectron: {
      borderTopColor: Styles.globalColors.black_10,
      borderTopStyle: 'solid',
      borderTopWidth: 1,
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
    isMobile: {
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      width: '100%',
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
  header: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purpleDark,
    },
    isElectron: {
      flex: 1,
      minHeight: 160,
    },
    isMobile: {
      flexBasis: 'auto',
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 250,
    },
  }),
  headerContent: Styles.platformStyles({
    isElectron: {
      marginTop: -20,
    },
  }),
  headerIcon: {
    marginBottom: Styles.globalMargins.small,
  },
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

  backgroundColorPurple: {backgroundColor: Styles.globalColors.purpleDark},
  button: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  buttonIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  buttonText: {color: Styles.globalColors.white},
  scrollView: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 1,
  },
})

export default PaymentsConfirm
