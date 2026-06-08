import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import MarkdownMemo from '@/wallets/markdown-memo'
import {useCurrentUserState} from '@/stores/current-user'
import {useConversationThreadSelector} from '../../thread-context'

// Props for rendering the loading indicator
const loadingProps = {
  _paymentID: undefined,
  action: '',
  amount: '',
  approxWorth: '',
  balanceChange: '',
  balanceChangeColor: undefined,
  canceled: false,
  icon: 'iconfont-stellar-send',
  loading: true,
  memo: '',
  pending: false,
  showCoinsIcon: false,
} as const

const failedProps = {
  ...loadingProps,
  loading: false,
}

// Get action phrase for sendPayment msg
const makeSendPaymentVerb = (status: T.Wallets.StatusSimplified, youAreSender: boolean) => {
  switch (status) {
    case 'pending':
      return 'sending'
    case 'canceled': // fallthrough
    case 'claimable':
      return youAreSender ? 'sending' : 'attempting to send'
    case 'error':
      return youAreSender ? 'attempted to send' : 'attempted to send'
    default:
      return 'sent'
  }
}

type OwnProps = {
  message: T.Chat.MessageSendPayment | T.Chat.MessageRequestPayment
}

type AccountsInfoMap = ReadonlyMap<T.RPCChat.MessageID, T.Chat.ChatRequestInfo | T.Chat.ChatPaymentInfo>

const getRequestMessageInfo = (
  accountsInfoMap: AccountsInfoMap,
  message: T.Chat.MessageRequestPayment
) => {
  const maybeRequestInfo = accountsInfoMap.get(message.id)
  if (!maybeRequestInfo) {
    return message.requestInfo
  }
  if (maybeRequestInfo.type === 'requestInfo') {
    return maybeRequestInfo
  }
  throw new Error(
    `Found impossible type ${maybeRequestInfo.type} in info meant for requestPayment message. convID: ${message.conversationIDKey} msgID: ${message.id}`
  )
}

const ConnectedAccountPayment = (ownProps: OwnProps) => {
  const you = useCurrentUserState(s => s.username)
  const accountsInfoMap = useConversationThreadSelector(s => s.accountsInfoMap)

  const stateProps = (() => {
    const youAreSender = ownProps.message.author === you
    switch (ownProps.message.type) {
      case 'sendPayment': {
        const paymentInfo = Chat.getPaymentMessageInfo(accountsInfoMap, ownProps.message)
        if (!paymentInfo) {
          // waiting for service to load it (missed service cache on loading thread)
          return loadingProps
        }

        const cancelable = paymentInfo.status === 'claimable'
        const pending = cancelable || paymentInfo.status === 'pending'
        const canceled = paymentInfo.status === 'canceled'
        const completed = paymentInfo.status === 'completed'
        const verb = makeSendPaymentVerb(paymentInfo.status, youAreSender)
        const amountDescription = paymentInfo.sourceAmount
          ? `${paymentInfo.amountDescription}/${paymentInfo.issuerDescription}`
          : paymentInfo.amountDescription
        const amount = paymentInfo.worth ? paymentInfo.worth : amountDescription
        return {
          _paymentID: paymentInfo.paymentID,
          action: paymentInfo.worth ? `${verb} Lumens worth` : verb,
          amount,
          approxWorth: paymentInfo.worthAtSendTime,
          balanceChange: '',
          balanceChangeColor: Kb.Styles.globalColors.black,
          canceled,
          icon: pending ? ('iconfont-clock' as const) : undefined,
          loading: false,
          memo: paymentInfo.note.stringValue(),
          pending: pending || canceled,
          showCoinsIcon: completed,
        }
      }
      case 'requestPayment': {
        const message = ownProps.message
        const requestInfo = getRequestMessageInfo(accountsInfoMap, message)
        if (!requestInfo) {
          // waiting for service to load it
          return loadingProps
        }
        const {amountDescription, asset, canceled} = requestInfo
        return {
          _paymentID: undefined,
          action: asset === 'currency' ? 'requested Lumens worth' : 'requested',
          amount: amountDescription,
          approxWorth: requestInfo.worthAtRequestTime,
          balanceChange: '',
          balanceChangeColor: undefined,
          canceled,
          icon: 'iconfont-stellar-request' as const,
          loading: false,
          memo: message.note.stringValue(),
          pending: false,
          showCoinsIcon: false,
        }
      }
      default:
        return failedProps
    }
  })()

  const {action, amount, approxWorth, balanceChange, balanceChangeColor} = stateProps
  const {canceled, icon, loading, memo, pending, showCoinsIcon} = stateProps
  const balanceChangeBox = (
    <Kb.Box2
      direction="horizontal"
      fullWidth={isMobile}
      style={styles.amountContainer}
      gap={isMobile ? 'tiny' : 'small'}
    >
      {!!balanceChange && (
        <Kb.Text type="BodyExtrabold" selectable={true} style={{color: balanceChangeColor}}>
          {balanceChange}
        </Kb.Text>
      )}
      {showCoinsIcon && <Kb.ImageIcon type="icon-stellar-coins-stacked-16" />}
    </Kb.Box2>
  )
  const contents = loading ? (
    <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} alignItems="center">
      <Kb.ProgressIndicator style={styles.progressIndicator} />
      <Kb.Text type="BodySmall">loading...</Kb.Text>
    </Kb.Box2>
  ) : (
    <>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="center"
        style={Kb.Styles.collapseStyles([
          styles.flexWrap,
          {marginBottom: Kb.Styles.globalMargins.xtiny},
        ])}
      >
        <Kb.Box2 direction="horizontal" gap="xtiny" gapEnd={true} alignItems="center">
          {!!icon && (
            <Kb.Icon
              type={icon}
              color={pending ? Kb.Styles.globalColors.purpleOrWhite : Kb.Styles.globalColors.purple}
              fontSize={12}
            />
          )}
          <Kb.Text
            type="BodySmall"
            style={Kb.Styles.collapseStyles([
              {flexShrink: 1},
              styles.purple,
              pending && styles.purpleOrWhite,
              canceled && styles.lineThrough,
            ])}
          >
            {action}{' '}
            <Kb.Text
              type="BodySmallExtrabold"
              selectable={true}
              style={Kb.Styles.collapseStyles([styles.purple, pending && styles.purpleOrWhite])}
            >
              {amount}
            </Kb.Text>
            {approxWorth && (
              <Kb.Text
                type="BodySmall"
                style={Kb.Styles.collapseStyles([styles.purple, pending && styles.purpleOrWhite])}
              >
                {' '}
                (approximately{' '}
                <Kb.Text
                  type="BodySmallExtrabold"
                  selectable={true}
                  style={Kb.Styles.collapseStyles([styles.purple, pending && styles.purpleOrWhite])}
                >
                  {approxWorth}
                </Kb.Text>
                )
              </Kb.Text>
            )}
            {pending ? '...' : '.'}
          </Kb.Text>
        </Kb.Box2>
        {canceled && <Kb.Text type="BodySmall">CANCELED</Kb.Text>}
        {!isMobile && balanceChangeBox}
      </Kb.Box2>
      <MarkdownMemo memo={memo} style={styles.memo} />
      {isMobile && balanceChangeBox}
    </>
  )
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      {contents}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      amountContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          marginLeft: 'auto',
        },
        isMobile: {justifyContent: 'space-between'},
      }),
      flexWrap: {flexWrap: 'wrap'},
      lineThrough: {textDecorationLine: 'line-through'},
      memo: Kb.Styles.platformStyles({
        isMobile: {paddingRight: Kb.Styles.globalMargins.small},
      }),
      progressIndicator: Kb.Styles.platformStyles({
        // Match height of a line of text
        isElectron: {
          ...Kb.Styles.size(17),
        },
        isMobile: {
          ...Kb.Styles.size(22),
        },
      }),
      purple: {color: Kb.Styles.globalColors.purpleDark},
      purpleOrWhite: {color: Kb.Styles.globalColors.purpleDarkOrWhite},
    }) as const
)

export default ConnectedAccountPayment
