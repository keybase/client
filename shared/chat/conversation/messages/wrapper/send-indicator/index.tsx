import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type AnimationStatus =
  | 'encrypting'
  | 'encryptingExploding'
  | 'error'
  | 'sending'
  | 'sendingExploding'
  | 'sent'
const statusToIcon: {[K in AnimationStatus]: Kb.AnimationType} = {
  encrypting: 'messageStatusEncrypting',
  encryptingExploding: 'messageStatusEncryptingExploding',
  error: 'messageStatusError',
  sending: 'messageStatusSending',
  sendingExploding: 'messageStatusSendingExploding',
  sent: 'messageStatusSent',
}
const statusToIconDark: {[K in AnimationStatus]: Kb.AnimationType} = {
  encrypting: 'darkMessageStatusEncrypting',
  encryptingExploding: 'darkMessageStatusEncryptingExploding',
  error: 'darkMessageStatusError',
  sending: 'darkMessageStatusSending',
  sendingExploding: 'darkMessageStatusSendingExploding',
  sent: 'darkMessageStatusSent',
}

const shownEncryptingSet = new Set()

const SendIndicatorContainer = React.memo(function SendIndicatorContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const isExploding = Container.useSelector(state => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    return !!message?.exploding
  })
  const sent = Container.useSelector(state => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    return (
      (message?.type !== 'text' && message?.type !== 'attachment') || !message.submitState || message.exploded
    )
  })
  const failed = Container.useSelector(state => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    return (message?.type === 'text' || message?.type === 'attachment') && message.submitState === 'failed'
  })
  const id = Container.useSelector(state => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
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

  let animationType = Styles.isDarkMode() ? statusToIconDark[status] : statusToIcon[status]
  // There is no exploding-error state
  if (isExploding && status !== 'error') {
    animationType = `${animationType}Exploding` as Kb.AnimationType
  }

  const lastFailedRef = React.useRef(failed)
  const lastSentRef = React.useRef(sent)
  React.useEffect(() => {
    if (failed && !lastFailedRef.current) {
      setStatus('error')
      timeoutRef.current && clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    } else if (sent && !lastSentRef.current) {
      setStatus('sent')
      timeoutRef.current && clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        timeoutRef.current = undefined
      }, 400)
    } else if (!failed && lastFailedRef.current) {
      setVisible(true)
      setStatus('sending')
    }
    lastFailedRef.current = failed
    lastSentRef.current = sent
  }, [failed, sent])

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
  return (
    <Kb.Animation
      animationType={animationType}
      className="sendingStatus"
      containerStyle={styles.send}
      style={visible ? styles.animationVisible : styles.animationInvisible}
    />
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      animationInvisible: Styles.platformStyles({
        common: {height: 20, opacity: 0, width: 20},
        isMobile: {backgroundColor: Styles.globalColors.white},
      }),
      animationVisible: Styles.platformStyles({
        common: {height: 20, opacity: 1, width: 20},
        isMobile: {
          backgroundColor: Styles.globalColors.white,
          borderRadius: 10,
        },
      }),
      send: Styles.platformStyles({
        common: {
          position: 'absolute',
          right: 16,
          top: 0,
        },
        isElectron: {pointerEvents: 'none'},
      }),
    } as const)
)

export default SendIndicatorContainer
