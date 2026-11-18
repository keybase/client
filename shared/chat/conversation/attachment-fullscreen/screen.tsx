import * as T from '@/constants/types'
import * as React from 'react'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import Full from '.'
import {takeAttachmentPreviewMessage} from '../attachment-actions'

type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
}

const SeededFull = (p: {
  conversationIDKey: T.Chat.ConversationIDKey
  initialMessage?: T.Chat.MessageAttachment
  isPortrait: boolean
  messageID: T.Chat.MessageID
  viewKey: number
}) => {
  const {conversationIDKey, initialMessage, isPortrait, messageID, viewKey} = p

  return (
    <Full
      conversationIDKey={conversationIDKey}
      initialMessage={initialMessage}
      messageID={messageID}
      showHeader={isPortrait}
      key={String(viewKey)}
    />
  )
}

const Screen = (p: OwnProps) => {
  const conversationIDKey = p.conversationIDKey ?? T.Chat.noConversationIDKey
  const [initialMessage] = React.useState(() =>
    takeAttachmentPreviewMessage(conversationIDKey, p.messageID)
  )
  const {width, height} = useSafeAreaFrame()
  const isPortrait = height > width
  // A new window size (a rotation, an iPhone Duo folding or entering Split View) remounts the
  // viewer: the zoom view keeps its old measurements and can leave the media off screen.
  const size = `${width}x${height}`
  const lastSizeRef = React.useRef(size)
  const [key, setKey] = React.useState(0)

  React.useEffect(() => {
    if (size !== lastSizeRef.current) {
      lastSizeRef.current = size
      setKey(k => k + 1)
    }
  }, [size])

  return (
    <SeededFull
      conversationIDKey={conversationIDKey}
      initialMessage={initialMessage}
      isPortrait={isPortrait}
      messageID={p.messageID}
      viewKey={key}
    />
  )
}

export default Screen
