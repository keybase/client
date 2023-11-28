import * as C from '@/constants'
import {OrdinalContext} from '../../ids-context'
import * as React from 'react'
import * as Kb from '@/common-adapters'

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
  const ordinal = React.useContext(OrdinalContext)
  const isExploding = C.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    return !!message?.exploding
  })
  const sent = C.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    return (
      (message?.type !== 'text' && message?.type !== 'attachment') || !message.submitState || message.exploded
    )
  })
  const failed = C.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    return (message?.type === 'text' || message?.type === 'attachment') && message.submitState === 'failed'
  })
  const id = C.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    return message?.timestamp
  })

  const [status, setStatus] = React.useState<AnimationStatus>(
    sent ? 'sent' : failed ? 'error' : !shownEncryptingSet.has(id) ? 'encrypting' : 'sending'
  )

  // only show encrypting once per
  if (status === 'encrypting') {
    shownEncryptingSet.add(id)
  }

  const [visible, setVisible] = React.useState(!sent)

  const timeoutRef = React.useRef<ReturnType<typeof setInterval> | undefined>()

  const animationType: Kb.AnimationType | undefined = isExploding
    ? Kb.Styles.isDarkMode()
      ? statusToIconDarkExploding[status]
      : statusToIconExploding[status]
    : Kb.Styles.isDarkMode()
    ? statusToIconDark[status]
    : statusToIcon[status]

  const [lastFailed, setLastFailed] = React.useState(failed)
  const [lastSent, setLastSent] = React.useState(sent)

  if (failed !== lastFailed || sent !== lastSent) {
    setLastFailed(failed)
    setLastSent(sent)
    if (failed && !lastFailed) {
      setStatus('error')
      timeoutRef.current && clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    } else if (sent && !lastSent) {
      setStatus('sent')
      timeoutRef.current && clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        timeoutRef.current = undefined
      }, 400)
    } else if (!failed && lastFailed) {
      setVisible(true)
      setStatus('sending')
    }
  }

  if (status === 'encrypting' && !timeoutRef.current) {
    timeoutRef.current = setTimeout(() => {
      setStatus('sending')
      timeoutRef.current = undefined
    }, 600)
  }

  React.useEffect(() => {
    return () => {
      timeoutRef.current && clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  if (!visible || (isExploding && status === 'sent')) {
    return null
  }
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
