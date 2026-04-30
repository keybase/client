import * as T from '@/constants/types'
import * as React from 'react'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import Full from '.'
import {takeAttachmentPreviewMessage} from '../attachment-actions'

type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
}

const SeededFull = (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  initialMessage?: T.Chat.MessageAttachment
  isPortrait: boolean
  ordinal: T.Chat.Ordinal
  viewKey: number
}) => {
  const {conversationIDKey, initialMessage, isPortrait, ordinal, viewKey} = p

  return (
    <Full
      conversationIDKey={conversationIDKey}
      initialMessage={initialMessage}
      ordinal={ordinal}
      showHeader={isPortrait}
      key={String(viewKey)}
    />
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
    <SeededFull
      conversationIDKey={conversationIDKey}
      initialMessage={initialMessage}
      isPortrait={isPortrait}
      ordinal={p.ordinal}
      viewKey={key}
    />
  )
}

export default Screen
