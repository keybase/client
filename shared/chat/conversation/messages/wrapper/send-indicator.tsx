import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useColorScheme} from 'react-native'

type AnimationStatus =
  | 'encrypting'
  | 'encryptingExploding'
  | 'error'
  | 'sending'
  | 'sendingExploding'
  | 'sent'
const statusToIcon = {
  encrypting: 'messageStatusEncrypting',
  encryptingExploding: 'messageStatusEncryptingExploding',
  error: 'messageStatusError',
  sending: 'messageStatusSending',
  sendingExploding: 'messageStatusSendingExploding',
  sent: 'messageStatusSent',
} as const
const statusToIconDark = {
  encrypting: 'darkMessageStatusEncrypting',
  encryptingExploding: 'darkMessageStatusEncryptingExploding',
  error: 'darkMessageStatusError',
  sending: 'darkMessageStatusSending',
  sendingExploding: 'darkMessageStatusSendingExploding',
  sent: 'darkMessageStatusSent',
} as const

const statusToIconExploding = {
  encrypting: 'messageStatusEncryptingExploding',
  encryptingExploding: undefined,
  error: undefined,
  sending: 'messageStatusSendingExploding',
  sendingExploding: undefined,
  sent: undefined,
} as const
const statusToIconDarkExploding = {
  encrypting: 'darkMessageStatusEncryptingExploding',
  encryptingExploding: undefined,
  error: undefined,
  sending: 'darkMessageStatusSendingExploding',
  sendingExploding: undefined,
  sent: undefined,
} as const

const shownEncryptingSet = new Set()

type OwnProps = {
  failed: boolean
  id: number
  isExploding: boolean
  sent: boolean
}

function SendIndicatorContainer(p: OwnProps) {
  return <SendIndicator key={p.id} {...p} />
}

type IndicatorState = {
  encrypting: boolean
  failed: boolean
  sent: boolean
  sentHidden: boolean
}

function SendIndicator(p: OwnProps) {
  const {failed, id, isExploding, sent} = p

  const [indicatorState, setIndicatorState] = React.useState<IndicatorState>(() => ({
    encrypting: !sent && !failed && !shownEncryptingSet.has(id),
    failed,
    sent,
    sentHidden: sent,
  }))

  let currentIndicatorState = indicatorState
  if (indicatorState.failed !== failed || indicatorState.sent !== sent) {
    const hasTerminalState = indicatorState.failed || indicatorState.sent || failed || sent
    currentIndicatorState = {
      encrypting: hasTerminalState ? false : indicatorState.encrypting,
      failed,
      sent,
      sentHidden: sent ? (indicatorState.sent === sent ? indicatorState.sentHidden : false) : false,
    }
    setIndicatorState(currentIndicatorState)
  }
  const {encrypting, sentHidden} = currentIndicatorState

  React.useEffect(() => {
    if (!encrypting || failed || sent) {
      return undefined
    }
    shownEncryptingSet.add(id)
    const timeoutID = setTimeout(() => {
      setIndicatorState(state => ({...state, encrypting: false}))
    }, 600)
    return () => {
      clearTimeout(timeoutID)
    }
  }, [encrypting, failed, id, sent])

  React.useEffect(() => {
    if (!sent || failed || sentHidden) {
      return undefined
    }
    const timeoutID = setTimeout(() => {
      setIndicatorState(state => (state.sent ? {...state, sentHidden: true} : state))
    }, 400)
    return () => {
      clearTimeout(timeoutID)
    }
  }, [failed, sent, sentHidden])

  const visible = failed || !sent || !sentHidden
  const status: AnimationStatus = failed ? 'error' : sent ? 'sent' : encrypting ? 'encrypting' : 'sending'

  const isDarkMode = useColorScheme() === 'dark'

  if (!visible || (isExploding && status === 'sent')) {
    return null
  }

  const animationType: Kb.AnimationType | undefined = isExploding
    ? isDarkMode
      ? statusToIconDarkExploding[status]
      : statusToIconExploding[status]
    : isDarkMode
      ? statusToIconDark[status]
      : statusToIcon[status]

  return animationType ? (
    <Kb.Animation
      animationType={animationType}
      className="sendingStatus"
      containerStyle={styles.send}
      style={styles.animationVisible}
    />
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      animationVisible: Kb.Styles.platformStyles({
        common: {height: 20, opacity: 1, width: 20},
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.white,
          borderRadius: 10,
        },
      }),
      send: Kb.Styles.platformStyles({
        common: {
          position: 'absolute',
          top: 3,
        },
        isElectron: {
          pointerEvents: 'none',
          right: 16,
        },
        isMobile: {right: 8},
      }),
    }) as const
)

export default SendIndicatorContainer
