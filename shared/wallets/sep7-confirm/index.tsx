import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletBackButton} from '../common'

type Props = {
  loading: boolean
  onAccept: () => void
  onCancel: () => void
}

type LoadingProps = {}

type CallbackURLBannerProps = {
  callbackURL: string
}
const CallbackURLBanner = (props: CallbackURLBannerProps) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    centerChildren={true}
    style={{backgroundColor: Styles.globalColors.blue, padding: Styles.globalMargins.tiny}}
  >
    <Kb.Text type="BodySemibold" negative={true}>
      The payment will be sent to {props.callbackURL}.
    </Kb.Text>
  </Kb.Box2>
)

type InfoRowProps = {
  bodyText: string
  headerText: string
  showStellarIcon?: boolean
}
const InfoRow = (props: InfoRowProps) => (
  <>
    <Kb.Divider />
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        {props.headerText}
      </Kb.Text>
      {props.showStellarIcon ? (
        <Kb.Box2 direction="horizontal" gap="xtiny">
          <Kb.Icon type="iconfont-identity-stellar" style={Kb.iconCastPlatformStyles(styles.stellarIcon)} />
          <Kb.Text selectable={true} type="Body" style={styles.stellarAddressConfirmText}>
            {props.bodyText}
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Text selectable={true} type="Body" style={styles.bodyText}>
          {props.bodyText}
        </Kb.Text>
      )}
    </Kb.Box2>
  </>
)

type HeaderProps = {
  onBack: () => void
  originDomain: string
  isPayment: boolean
}
const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContent}>
      {!!props.isPayment && <Kb.Icon sizeType="Tiny" type="icon-stellar-coins-sending-48" />}
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        fullWidth={true}
        style={{marginTop: Styles.globalMargins.xlarge}}
      >
        <Kb.Text selectable={true} type="BodyBig" negative={true}>
          {props.originDomain}
        </Kb.Text>
        <Kb.Box2
          direction="horizontal"
          style={{backgroundColor: Styles.globalColors.transparent, marginLeft: Styles.globalMargins.xtiny}}
        >
          <Kb.Icon sizeType="Small" style={styles.verifiedIcon} type="iconfont-success" />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Text negative={true} type="BodyBig">
        is requesting a {props.isPayment ? 'a payment' : ' you to sign a transaction'}.
      </Kb.Text>
      <Kb.Text style={styles.subHeaderText} negative={true} type="Body">
        Keybase verified the request's signature.
      </Kb.Text>
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

type PaymentInfoProps = {
  amount: string
  memo: string | null
  message: string | null
  recipient: string
}
const PaymentInfo = (props: PaymentInfoProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {!!props.amount && (
      <>
        <Kb.Divider />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
          <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
            Amount
          </Kb.Text>
          <Kb.Text type="HeaderBigExtrabold" style={{color: Styles.globalColors.purple}}>
            {props.amount} XLM
          </Kb.Text>
        </Kb.Box2>
      </>
    )}

    {!!props.memo && <InfoRow headerText="Memo" bodyText={props.memo} />}

    {!!props.message && <InfoRow headerText="Message" bodyText={props.message} />}

    {!!props.recipient && <InfoRow headerText="Recipient" bodyText={props.recipient} showStellarIcon={true} />}
  </Kb.Box2>
)

type TxInfoProps = {
  operations: Array<string>
  fee: string
  memo: string | null
  source: string
}
const TxInfo = (props: TxInfoProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.operations.length > 0 &&
      props.operations.map((op, idx) => (
        <InfoRow key={idx + 1} headerText={`Operation ${idx + 1}`} bodyText={op} />
      ))}

    {!!props.fee && <InfoRow headerText="Fee" bodyText={props.fee + ' stroops'} />}

    {!!props.memo && <InfoRow headerText="Memo" bodyText={props.memo} />}

    {!!props.source && <InfoRow headerText="Source account" bodyText={props.source} showStellarIcon={true} />}
  </Kb.Box2>
)

const PaymentsConfirm = (props: Props) =>
  props.loading ? (
    <PaymentsConfirmLoading />
  ) : (
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" fullHeight={!Styles.isMobile} fullWidth={true} style={styles.container}>
        <Header
          isPayment={props.operation === 'pay'}
          originDomain={props.originDomain}
          onBack={props.onBack}
        />
        {!!props.callbackURL && <CallbackURLBanner callbackURL={props.callbackURL} />}
        <Kb.ScrollView style={styles.scrollView} alwaysBounceVertical={false}>
          {props.operation === 'pay' ? (
            <PaymentInfo
              amount={props.amount}
              memo={props.memo}
              message={props.message}
              recipient={props.recipient}
            />
          ) : (
            <TxInfo
              fee={props.summary.fee}
              source={props.summary.source}
              operations={props.summary.operations}
            />
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
              label={props.operation === 'pay' ? 'Pay' : 'Sign'}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.SafeAreaView />
    </Kb.MaybePopup>
  )

const styles = Styles.styleSheetCreate({
  backgroundColorPurple: {backgroundColor: Styles.globalColors.purpleDark},
  bodyText: Styles.platformStyles({
    common: {color: Styles.globalColors.black},
    isElectron: {wordBreak: 'break-word'},
  }),
  button: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
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
  buttonIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  buttonText: {color: Styles.globalColors.white},
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
  headerContent: {
    alignItems: 'center',
    marginTop: Styles.globalMargins.tiny,
  },
  headingText: {
    color: Styles.globalColors.black_50,
    marginBottom: Styles.globalMargins.xtiny,
  },
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.small,
      marginTop: 35,
    },
  }),
  memoContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
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
  scrollView: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 1,
  },
  stellarAddressConfirmText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
  subHeaderText: {
    color: Styles.globalColors.white_75,
    paddingTop: Styles.globalMargins.tiny,
  },
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
  verifiedIcon: Styles.platformStyles({
    common: {
      color: Styles.globalColors.green,
    },
  }),
  xlmTotal: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
    },
  }),
})

export default PaymentsConfirm
