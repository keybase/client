import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletBackButton} from '../common'
import AssetInput from './asset-input-container'

type Summary = {
  fee: string
  memo: string
  memoType: string
  operations: Array<string>
  source: string
}

type Props = {
  amount: string | null
  availableToSendNative: string
  callbackURL: string | null
  displayAmountFiat: string
  displayAmountNative: string
  error: string
  loading: boolean
  memo: string | null
  memoType: string | null
  message: string | null
  onAcceptPay: (amount: string) => void
  onAcceptTx: () => void
  onBack: () => void
  onChangeAmount: (amount: string) => void
  operation: 'pay' | 'tx'
  originDomain: string
  recipient: string | null
  summary: Summary
  waitingKey: string
}

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

type ErrorProps = {error: string; onBack: () => void}
const Error = (props: ErrorProps) => (
  <Kb.MaybePopup onClose={props.onBack}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.dialog}>
        <Kb.Text type="Body">{props.error}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.MaybePopup>
)

type LoadingProps = {onBack: () => void}
const Loading = (props: LoadingProps) => (
  <Kb.MaybePopup onClose={props.onBack}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        fullWidth={true}
        fullHeight={true}
        style={styles.dialog}
      >
        <Kb.ProgressIndicator />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.MaybePopup>
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
        is requesting {props.isPayment ? 'a payment' : 'you to sign a transaction'}.
      </Kb.Text>
      <Kb.Text style={styles.subHeaderText} negative={true} type="Body">
        Keybase verified the request's signature.
      </Kb.Text>
    </Kb.Box2>
    <WalletBackButton onBack={props.onBack} />
  </Kb.Box2>
)

type PaymentInfoProps = {
  amount: string
  availableToSendNative: string
  displayAmountFiat: string
  memo: string | null
  message: string | null
  onChangeAmount: (amount: string) => void
  recipient: string
}
const PaymentInfo = (props: PaymentInfoProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Divider />
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        Amount
      </Kb.Text>
      {!!props.amount && (
        <>
          <Kb.Text type="HeaderBigExtrabold" style={styles.purpleText}>
            {props.amount} XLM
          </Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" gapStart={true} gapEnd={false}>
            <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
              (Approximately {props.displayAmountFiat})
            </Kb.Text>
            <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
              Your primary account has {props.availableToSendNative} available to send.
            </Kb.Text>
          </Kb.Box2>
        </>
      )}
    </Kb.Box2>

    {!props.amount && <AssetInput />}

    {!!props.memo && <InfoRow headerText="Memo" bodyText={props.memo} />}

    {!!props.message && <InfoRow headerText="Message" bodyText={props.message} />}

    {!!props.recipient && (
      <InfoRow headerText="Recipient" bodyText={props.recipient} showStellarIcon={true} />
    )}
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

const SEP7Confirm = (props: Props) =>
  props.loading ? (
    <Loading onBack={props.onBack} />
  ) : props.error ? (
    <Error error={props.error} onBack={props.onBack} />
  ) : (
    <Kb.MaybePopup onClose={props.onBack}>
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
              availableToSendNative={props.availableToSendNative}
              displayAmountFiat={props.displayAmountFiat}
              memo={props.memoType === 'MEMO_TEXT' && props.memo}
              message={props.message}
              onChangeAmount={props.onChangeAmount}
              recipient={props.recipient}
            />
          ) : (
            <TxInfo
              fee={props.summary.fee}
              memo={props.summary.memo}
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
          <Kb.WaitingButton
            type="Success"
            onClick={props.operation === 'pay' ? () => props.onAcceptPay(props.amount) : props.onAcceptTx}
            waitingKey={props.waitingKey}
            fullWidth={true}
            style={styles.button}
            label={props.operation === 'pay' ? 'Pay' : 'Sign'}
          />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.SafeAreaView />
    </Kb.MaybePopup>
  )

const styles = Styles.styleSheetCreate({
  bodyText: Styles.platformStyles({
    common: {color: Styles.globalColors.black},
    isElectron: {wordBreak: 'break-word'},
  }),
  button: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
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
  dialog: {
    padding: Styles.globalMargins.large,
  },
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
  memoContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  purpleText: Styles.platformStyles({
    common: {color: Styles.globalColors.purple},
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
  verifiedIcon: Styles.platformStyles({
    common: {
      color: Styles.globalColors.green,
    },
  }),
})

export default SEP7Confirm
