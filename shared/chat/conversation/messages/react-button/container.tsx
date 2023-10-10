import * as C from '../../../../constants'
import * as React from 'react'
import ReactButton, {NewReactionButton} from '.'
import type {StylesCrossPlatform} from '../../../../styles'
import {OrdinalContext} from '../ids-context'

export type OwnProps = {
  className?: string
  emoji?: string
  onLongPress?: () => void
  onShowPicker?: (showing: boolean) => void
  showBorder?: boolean
  style?: StylesCrossPlatform
}

const ReactButtonContainer = React.memo(function ReactButtonContainer(p: OwnProps) {
  const ordinal = React.useContext(OrdinalContext)
  const {emoji, className} = p
  const {onLongPress, onShowPicker, showBorder, style} = p
  const me = C.useCurrentUserState(s => s.username)
  const {active, count, decorated} = C.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      const reaction = message?.reactions?.get(emoji || '')
      const active = [...(reaction?.users ?? [])].some(r => r.username === me)
      return {
        active,
        count: reaction?.users.size ?? 0,
        decorated: reaction?.decorated ?? '',
      }
    })
  )

  const toggleMessageReaction = C.useChatContext(s => s.dispatch.toggleMessageReaction)
  const onAddReaction = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )
  const onClick = React.useCallback(() => {
    toggleMessageReaction(ordinal, emoji || '')
  }, [toggleMessageReaction, emoji, ordinal])
  const navigateAppend = C.useChatNavigateAppend()
  const onOpenEmojiPicker = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, onPickAddToMessageOrdinal: ordinal, pickKey: 'reaction'},
      selected: 'chatChooseEmoji',
    }))
  }, [navigateAppend, ordinal])

  return emoji ? (
    <ReactButton
      active={active}
      className={className}
      count={count}
      emoji={emoji}
      decorated={decorated}
      onClick={onClick}
      onLongPress={onLongPress}
      style={style}
    />
  ) : (
    <NewReactionButton
      onAddReaction={onAddReaction}
      onLongPress={onLongPress}
      onOpenEmojiPicker={onOpenEmojiPicker}
      onShowPicker={onShowPicker}
      showBorder={showBorder || false}
      style={style}
    />
  )
})

export default ReactButtonContainer
