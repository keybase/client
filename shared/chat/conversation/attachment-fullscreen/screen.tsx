import * as T from '@/constants/types'
import * as React from 'react'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import Full from '.'
import {takeAttachmentPreviewMessage} from '../attachment-actions'
import {
  ConversationThreadBridgeProvider,
  useConversationThreadActions,
  useConversationThreadMessage,
} from '../thread-context'

type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
}

const SeededFull = (p: {
  initialMessage?: T.Chat.MessageAttachment
  isPortrait: boolean
  ordinal: T.Chat.Ordinal
  viewKey: number
}) => {
  const {initialMessage, isPortrait, ordinal, viewKey} = p
  const {addMessages} = useConversationThreadActions()
  const existing = useConversationThreadMessage(initialMessage?.ordinal ?? ordinal)

  React.useEffect(() => {
    if (initialMessage && existing?.type !== 'attachment') {
      addMessages([initialMessage])
    }
  }, [existing?.type, initialMessage, addMessages])

  return (
    <Full initialMessage={initialMessage} ordinal={ordinal} showHeader={isPortrait} key={String(viewKey)} />
  )
}

const Screen = (p: OwnProps) => {
  const conversationIDKey = p.conversationIDKey ?? T.Chat.noConversationIDKey
  const [initialMessage] = React.useState(() => takeAttachmentPreviewMessage(conversationIDKey, p.ordinal))
  const {width, height} = useSafeAreaFrame()
  const isPortrait = height > width
  const wasPortraitRef = React.useRef(isPortrait)
  // reset zoom etc on change
  const [key, setKey] = React.useState(0)

  React.useEffect(() => {
    if (isPortrait !== wasPortraitRef.current) {
      wasPortraitRef.current = isPortrait
      setKey(k => k + 1)
    }
  }, [isPortrait])

  return (
    <ConversationThreadBridgeProvider id={conversationIDKey}>
      <SeededFull initialMessage={initialMessage} isPortrait={isPortrait} ordinal={p.ordinal} viewKey={key} />
    </ConversationThreadBridgeProvider>
  )
}

export default Screen
