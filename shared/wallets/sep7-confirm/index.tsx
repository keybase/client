import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import {WalletBackButton} from '../common'
import {AssetPathIntermediate} from '../send-form/asset-input/asset-input-advanced'
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
  assetCode: string
  availableToSendNative: string
  callbackURL: string | null
  displayAmountFiat: string
  loading: boolean
  memo: string | null
  memoType: string | null
  message: string | null
  onAcceptPath: () => void
  onAcceptPay: (amount: string) => void
  onAcceptTx: () => void
  onBack: () => void
  onChangeAmount: (amount: string) => void
  onLookupPath: () => void
  operation: 'pay' | 'tx'
  originDomain: string
  path: Types._BuiltPaymentAdvanced
  readyToSend: boolean
  recipient: string | null
  signed: boolean | null
  summary: Summary
  userAmount: string | null
  waitingKey: string
}

type CallbackURLBannerProps = {
  callbackURL: string
}
const CallbackURLBanner = (props: CallbackURLBannerProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.callbackURLBanner}>
    <Kb.Text type="BodySemibold" negative={true}>
      The payment will be sent to {props.callbackURL}.
    </Kb.Text>
  </Kb.Box2>
)

type LoadingProps = {
  onBack: () => void
}
const Loading = (props: LoadingProps) => (
  <Kb.MaybePopup onClose={props.onBack}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
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
        <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start">
          <Kb.Icon type="iconfont-identity-stellar" style={Kb.iconCastPlatformStyles(styles.stellarIcon)} />
          <Kb.Text lineClamp={2} selectable={true} type="Body" style={styles.bodyTextWithIcon}>
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
  requester: string | null
  isPayment: boolean
  signed: boolean | null
}
const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContent}>
      {!props.signed && (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Banner color="red">
            <Kb.BannerParagraph
              bannerColor="red"
              content="This link does not have an attached signature! Ensure that you trust the source of this link."
            />
          </Kb.Banner>
        </Kb.Box2>
      )}
      {!!props.isPayment && (
        <Kb.Icon sizeType="Tiny" type="icon-stellar-coins-sending-48" style={styles.sendIcon} />
      )}
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        fullWidth={true}
        style={{marginTop: Styles.globalMargins.xlarge}}
      >
        <Kb.Text selectable={true} type="BodyBig" negative={true}>
          {props.requester}
        </Kb.Text>
        {props.signed && (
          <Kb.Box2 direction="horizontal" style={styles.verifiedIconBox}>
            <Kb.Icon sizeType="Small" style={styles.verifiedIcon} type="iconfont-success" />
          </Kb.Box2>
        )}
      </Kb.Box2>
      <Kb.Text negative={true} type="BodyBig">
        {!props.requester && 'This link'} is requesting{' '}
        {props.isPayment ? 'a payment' : 'you to sign a transaction'}.
      </Kb.Text>
      {props.signed && (
        <Kb.Text style={styles.subHeaderText} negative={true} type="Body">
          Keybase verified the request's signature.
        </Kb.Text>
      )}
    </Kb.Box2>
  </Kb.Box2>
)

type PaymentInfoProps = {
  amount: string
  assetCode: string
  availableToSendNative: string
  displayAmountFiat: string
  exchangeRate: string
  memo: string | null
  message: string | null
  onChangeAmount: (amount: string) => void
  recipient: string
  userAmount: string
}
const PaymentInfo = (props: PaymentInfoProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Divider />
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        Amount
      </Kb.Text>
      {!!props.amount &&
        (props.assetCode ? (
          <>
            <Kb.Text type="HeaderBigExtrabold" style={styles.purpleText}>
              {props.amount} {props.assetCode}
            </Kb.Text>
            {props.exchangeRate ? (
              <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" gapStart={true} gapEnd={false}>
                <Kb.Text type="BodySmallSemibold" style={styles.headingText}>
                  (Exchange rate: {props.exchangeRate})
                </Kb.Text>
              </Kb.Box2>
            ) : (
              <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} fullHeight={true}>
                <Kb.ProgressIndicator type="Small" />
              </Kb.Box2>
            )}
          </>
        ) : (
          <>
            <Kb.Text type="HeaderBigExtrabold" style={styles.purpleText}>
              {props.amount} XLM
            </Kb.Text>
            <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" gapStart={true} gapEnd={false}>
              <Kb.Text type="BodySmallSemibold" style={styles.headingText}>
                (Approximately {props.displayAmountFiat})
              </Kb.Text>
              <Kb.Text type="BodySmallSemibold" style={styles.headingText}>
                Your primary account has {props.availableToSendNative} available to send.
              </Kb.Text>
            </Kb.Box2>
          </>
        ))}
    </Kb.Box2>
    {!!props.assetCode && <AssetPathIntermediate forSEP7={true} />}
    {!props.amount && <AssetInput amount={props.userAmount} onChangeAmount={props.onChangeAmount} />}
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
    {props.operations.map((op, idx) => (
      <InfoRow key={idx + 1} headerText={`Operation ${idx + 1}`} bodyText={op} />
    ))}
    {!!props.fee && <InfoRow headerText="Fee" bodyText={props.fee + ' stroops'} />}
    {!!props.memo && <InfoRow headerText="Memo" bodyText={props.memo} />}
    {!!props.source && <InfoRow headerText="Source account" bodyText={props.source} showStellarIcon={true} />}
  </Kb.Box2>
)

// Trim the given string to the first 20 characters if necessary. Note that we are doing it this way rather than
// using shortenAccountID since it doesn't feel right to chop out the middle of `reallylongnameonanotherservice@example.com`
const TrimString = (s: string | null) => {
  if (s === null) {
    return s
  }
  if (s.length < 20) {
    return s
  } else {
    return s.substring(0, 20) + '...'
  }
}

const SEP7Confirm = (props: Props) => (
  <Kb.MaybePopup onClose={props.onBack}>
    <Kb.Box2 direction="vertical" fullHeight={!Styles.isMobile} fullWidth={true} style={styles.container}>
      {Styles.isMobile && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.backButtonBox}>
          <WalletBackButton onBack={props.onBack} showCancelInsteadOfBackOnMobile={true} />
        </Kb.Box2>
      )}
      <Kb.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContents}
        alwaysBounceVertical={false}
      >
        <Header
          isPayment={props.operation === 'pay'}
          requester={props.signed ? props.originDomain : TrimString(props.recipient)}
          signed={props.signed}
        />
        {!!props.callbackURL && <CallbackURLBanner callbackURL={props.callbackURL} />}
        {props.operation === 'pay' ? (
          <PaymentInfo
            amount={props.amount || ''}
            assetCode={props.assetCode}
            availableToSendNative={props.availableToSendNative}
            displayAmountFiat={props.displayAmountFiat}
            exchangeRate={props.path.exchangeRate}
            memo={props.memoType === 'MEMO_TEXT' ? props.memo : ''}
            message={props.message}
            onChangeAmount={props.onChangeAmount}
            recipient={props.recipient || ''}
            userAmount={props.userAmount || ''}
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
          onClick={
            props.operation === 'pay'
              ? props.assetCode
                ? () => props.onAcceptPath()
                : () => props.onAcceptPay(props.amount || props.userAmount || '')
              : props.onAcceptTx
          }
          waitingKey={props.waitingKey}
          fullWidth={true}
          style={styles.button}
          label={props.operation === 'pay' ? 'Pay' : 'Sign'}
          disabled={!props.readyToSend}
        />
      </Kb.Box2>
    </Kb.Box2>
    <Kb.SafeAreaView />
  </Kb.MaybePopup>
)

const SEP7ConfirmWrapper = (props: Omit<Props, 'onChangeAmount' | 'readyToSend' | 'userAmount'>) => {
  const [userAmount, onChangeAmount] = React.useState('')
  React.useEffect(() => {
    props.assetCode && !props.path.exchangeRate && props.onLookupPath()
  }, [props.assetCode, props.path.exchangeRate])
  return props.loading ? (
    <Loading onBack={props.onBack} />
  ) : (
    <SEP7Confirm
      {...props}
      onChangeAmount={onChangeAmount}
      userAmount={userAmount}
      readyToSend={props.assetCode ? !!props.path.exchangeRate : !!props.amount || !!userAmount}
    />
  )
}

const styles = Styles.styleSheetCreate({
  backButtonBox: {
    backgroundColor: Styles.globalColors.purpleDark,
    minHeight: 46,
  },
  bodyText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black,
    },
    isElectron: {wordBreak: 'break-word'},
  }),
  bodyTextWithIcon: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
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
      borderBottomLeftRadius: Styles.borderRadius,
      borderBottomRightRadius: Styles.borderRadius,
      borderTopColor: Styles.globalColors.black_10,
      borderTopStyle: 'solid',
      borderTopWidth: 1,
    },
  }),
  callbackURLBanner: {
    backgroundColor: Styles.globalColors.blue,
    padding: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      borderTopLeftRadius: Styles.borderRadius,
      borderTopRightRadius: Styles.borderRadius,
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
      borderTopLeftRadius: Styles.borderRadius,
      borderTopRightRadius: Styles.borderRadius,
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
  scrollView: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purpleDark,
      flexBasis: 'auto',
      flexGrow: 1,
      flexShrink: 1,
    },
    isElectron: {
      borderTopLeftRadius: Styles.borderRadius,
      borderTopRightRadius: Styles.borderRadius,
      display: 'flex',
    },
  }),
  scrollViewContents: {
    backgroundColor: Styles.globalColors.white,
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  sendIcon: {
    marginTop: Styles.globalMargins.tiny,
  },
  stellarIcon: {
    alignSelf: 'flex-start',
    color: Styles.globalColors.black,
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
  verifiedIconBox: {
    backgroundColor: Styles.globalColors.transparent,
    marginLeft: Styles.globalMargins.xtiny,
  },
})

export default SEP7ConfirmWrapper
