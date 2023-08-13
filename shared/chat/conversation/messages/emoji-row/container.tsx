import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import * as React from 'react'
import EmojiRow from '.'
import type {Position, StylesCrossPlatform} from '../../../../styles'
import {ConvoIDContext, OrdinalContext} from '../ids-context'
import shallowEqual from 'shallowequal'

type OwnProps = {
  className?: string
  onShowingEmojiPicker?: (arg0: boolean) => void
  style?: StylesCrossPlatform
  tooltipPosition?: Position
}

const EmojiRowContainer = React.memo(function EmojiRowContainer(p: OwnProps) {
  const {className, onShowingEmojiPicker, style, tooltipPosition} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const {hasUnfurls, type} = Constants.useContext(s => {
    const m = s.messageMap.get(ordinal)
    const hasUnfurls = (m?.unfurls?.size ?? 0) > 0
    const type = m?.type
    return {hasUnfurls, type}
  }, shallowEqual)

  const emojis = C.useChatState(s => s.userReacjis.topReacjis.slice(0, 5), shallowEqual)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const toggleMessageReaction = Constants.useContext(s => s.dispatch.toggleMessageReaction)
  const onForward = React.useCallback(() => {
    navigateAppend({props: {ordinal, srcConvID: conversationIDKey}, selected: 'chatForwardMsgPick'})
  }, [navigateAppend, conversationIDKey, ordinal])
  const onReact = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )
  const setReplyTo = Constants.useContext(s => s.dispatch.setReplyTo)
  const onReply = React.useCallback(() => {
    setReplyTo(ordinal)
  }, [setReplyTo, ordinal])

  const props = {
    className,
    conversationIDKey,
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
