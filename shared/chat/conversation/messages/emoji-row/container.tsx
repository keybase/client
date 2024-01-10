import * as C from '@/constants'
import * as React from 'react'
import EmojiRow from '.'
import type {Position, StylesCrossPlatform} from '@/styles'
import {OrdinalContext} from '../ids-context'

type OwnProps = {
  className?: string
  onShowingEmojiPicker?: (arg0: boolean) => void
  style?: StylesCrossPlatform
  tooltipPosition?: Position
}

const EmojiRowContainer = React.memo(function EmojiRowContainer(p: OwnProps) {
  const {className, onShowingEmojiPicker, style, tooltipPosition} = p
  const ordinal = React.useContext(OrdinalContext)

  const hasUnfurls = C.useChatContext(s => (s.messageMap.get(ordinal)?.unfurls?.size ?? 0) > 0)
  const type = C.useChatContext(s => s.messageMap.get(ordinal)?.type)

  const allEmojis = C.useChatState(s => s.userReacjis.topReacjis)
  const emojis = React.useMemo(() => allEmojis.slice(0, 5), [allEmojis])
  const navigateAppend = C.Chat.useChatNavigateAppend()
  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const onForward = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, ordinal},
      selected: 'chatForwardMsgPick',
    }))
  }, [navigateAppend, ordinal])
  const onReact = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )
  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const onReply = React.useCallback(() => {
    setReplyTo(ordinal)
  }, [setReplyTo, ordinal])

  const props = {
    className,
    emojis,
    onForward: hasUnfurls || type === 'attachment' ? onForward : undefined,
    onReact,
    onReply: type === 'text' || type === 'attachment' ? onReply : undefined,
    onShowingEmojiPicker,
    ordinal,
    style,
    tooltipPosition,
  }
  return <EmojiRow {...props} />
})
export default EmojiRowContainer
