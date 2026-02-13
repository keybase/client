import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useOrdinal} from '../ids-context'
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

const SendIndicatorContainer = React.memo(function SendIndicatorContainer() {
  const ordinal = useOrdinal()

  const {isExploding, sent, failed, id} = Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      return {
        failed:
          (message?.type === 'text' || message?.type === 'attachment') && message.submitState === 'failed',
        id: message?.timestamp,
        isExploding: !!message?.exploding,
        sent:
          (message?.type !== 'text' && message?.type !== 'attachment') ||
          !message.submitState ||
          message.exploded,
      }
    })
  )

  const [status, setStatus] = React.useState<AnimationStatus>(
    sent ? 'sent' : failed ? 'error' : !shownEncryptingSet.has(id) ? 'encrypting' : 'sending'
  )
  const [visible, setVisible] = React.useState(!sent)
  const timeoutRef = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  React.useEffect(() => {
    if (status === 'encrypting' && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        setStatus('sending')
        timeoutRef.current = undefined
      }, 600)
    }

    if (status === 'encrypting') {
      shownEncryptingSet.add(id)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    }
  }, [status, id])

  React.useEffect(() => {
    if (failed) {
      setStatus('error')
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    } else if (sent) {
      setStatus('sent')
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        timeoutRef.current = undefined
      }, 400)
    } else {
      setVisible(true)
      setStatus('sending')
    }
  }, [failed, sent])

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
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      animationInvisible: Kb.Styles.platformStyles({
        common: {height: 20, opacity: 0, width: 20},
        isMobile: {backgroundColor: Kb.Styles.globalColors.white},
      }),
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
