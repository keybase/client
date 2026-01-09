import * as React from 'react'
import * as Styles from '@/styles'
import * as Chat from '@/stores/chat2'
import PaymentStatusError from './error'
import Text from '@/common-adapters/text'
import {Box2} from '@/common-adapters/box'
import Icon from '@/common-adapters/icon'
import type * as T from '@/constants/types'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type * as WalletTypes from '@/constants/types/wallets'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {useCurrentUserState} from '@/stores/current-user'

// This is actually a dependency of common-adapters/markdown so we have to treat it like a common-adapter, no * import allowed
const Kb = {
  Box2,
  Icon,
  Styles,
  Text,
}

type Status = 'error' | 'pending' | 'completed' | 'claimable'

export type Props = {
  allowFontScaling?: boolean
  allowPopup: boolean
  errorDetail?: string
  isSendError: boolean
  message: T.Chat.MessageText
  paymentID?: T.Wallets.PaymentID
  status: Status
  text: string
}

const getIcon = (status: Status) => {
  switch (status) {
    case 'completed':
      return 'iconfont-success'
    case 'claimable':
      return 'iconfont-success'
    case 'pending':
      return 'iconfont-clock'
    case 'error':
      return 'iconfont-remove'
    default:
      return 'iconfont-clock'
  }
}

const statusColor = (s: Status) => {
  switch (s) {
    case 'completed':
      return Kb.Styles.globalColors.purpleDarkOrWhite
    case 'claimable':
      return undefined
    case 'pending':
      return Kb.Styles.globalColors.black_50OrWhite
    case 'error':
      return Kb.Styles.globalColors.redDarkOrWhite
  }
}

const PaymentStatus = (props: Props) => {
  const statusRef = React.useRef<MeasureRef | null>(null)
  const [showPopup, setShowPopup] = React.useState(false)
  const _showPopup = () => {
    if (props.allowPopup) {
      setShowPopup(true)
    }
  }
  const _hidePopup = () => {
    setShowPopup(false)
  }
  const text = (
    <Kb.Text
      textRef={statusRef}
      type="BodyExtrabold"
      allowFontScaling={!!props.allowFontScaling}
      onClick={_showPopup}
    >
      {' '}
      <Kb.Text type="BodyExtrabold" allowFontScaling={!!props.allowFontScaling} style={styles[props.status]}>
        {props.text}{' '}
        <Kb.Icon
          type={getIcon(props.status)}
          fontSize={12}
          boxStyle={styles.iconBoxStyle}
          color={statusColor(props.status)}
        />
      </Kb.Text>{' '}
    </Kb.Text>
  )
  const popups = props.isSendError ? (
    <PaymentStatusError
      attachTo={statusRef}
      error={props.errorDetail || ''}
      onHidden={_hidePopup}
      visible={showPopup}
    />
  ) : null
  return Kb.Styles.isMobile ? (
    <>
      {text}
      {popups}
    </>
  ) : (
    <Kb.Box2
      style={styles.container}
      direction="horizontal"
      onMouseOver={_showPopup}
      onMouseLeave={_hidePopup}
    >
      {text}
      {popups}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      claimable: {
        backgroundColor: Kb.Styles.globalColors.purple_10OrPurple,
        borderRadius: Kb.Styles.globalMargins.xxtiny,
        color: Kb.Styles.globalColors.purpleDarkOrWhite,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
        paddingRight: Kb.Styles.globalMargins.xtiny,
      },
      completed: {
        backgroundColor: Kb.Styles.globalColors.purple_10OrPurple,
        borderRadius: Kb.Styles.globalMargins.xxtiny,
        color: Kb.Styles.globalColors.purpleDarkOrWhite,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
        paddingRight: Kb.Styles.globalMargins.xtiny,
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
      error: {
        backgroundColor: Kb.Styles.globalColors.red_10OrRed,
        borderRadius: Kb.Styles.globalMargins.xxtiny,
        color: Kb.Styles.globalColors.redDarkOrWhite,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
        paddingRight: Kb.Styles.globalMargins.xtiny,
      },
      iconBoxStyle: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline',
        },
      }),
      pending: {
        backgroundColor: Kb.Styles.globalColors.greyLight,
        borderRadius: Kb.Styles.globalMargins.xxtiny,
        color: Kb.Styles.globalColors.black_50OrWhite,
        paddingLeft: Kb.Styles.globalMargins.xtiny,
        paddingRight: Kb.Styles.globalMargins.xtiny,
      },
    }) as const
)

type OwnProps = {
  allowFontScaling?: boolean
  error?: string
  paymentID?: WalletTypes.PaymentID
  text: string
}

const reduceStatus = (status: string): Status => {
  switch (status) {
    case 'claimable':
      return 'claimable'
    case 'completed':
      return 'completed'
    case 'pending':
    case 'unknown':
      return 'pending'
    case 'error':
    case 'canceled':
    case 'none':
      return 'error'
    default:
      return 'pending'
  }
}

const PaymentStatusContainer = React.memo(function PaymentStatusContainer(p: OwnProps) {
  const {error, paymentID, text, allowFontScaling} = p
  const ordinal = useOrdinal()
  const paymentInfo = Chat.useChatState(s => (paymentID ? s.paymentStatusMap.get(paymentID) : undefined))
  const status = error ? 'error' : (paymentInfo?.status ?? 'pending')

  const you = useCurrentUserState(s => s.username)
  // TODO remove
  const message = Chat.useChatContext(s => s.messageMap.get(ordinal))
  const author = message?.author
  const allowPopup =
    status === 'completed' || status === 'pending' || status === 'claimable' || author === you
  if (message?.type !== 'text') return null

  const props = {
    allowFontScaling,
    allowPopup,
    errorDetail: error || paymentInfo?.statusDetail,
    isSendError: !!error,
    message,
    paymentID,
    status: reduceStatus(status),
    text,
  }
  return <PaymentStatus {...props} />
})

export default PaymentStatusContainer
