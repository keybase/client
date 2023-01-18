import * as React from 'react'
import {ConvoIDContext, OrdinalContext} from '../ids-context'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import type {StylesCrossPlatform} from '../../../../styles'
import ReactButton, {NewReactionButton} from '.'
import shallowEqual from 'shallowequal'

export type OwnProps = {
  className?: string
  emoji?: string
  getAttachmentRef?: () => React.Component<any> | null
  onLongPress?: () => void
  onShowPicker?: (showing: boolean) => void
  showBorder?: boolean
  style?: StylesCrossPlatform
}

const ReactButtonContainer = React.memo(function ReactButtonContainer(p: OwnProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {emoji, className} = p
  const {getAttachmentRef, onLongPress, onShowPicker, showBorder, style} = p
  const {active, count, decorated} = Container.useSelector(state => {
    const me = state.config.username
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    const reaction = message?.reactions?.get(emoji || '')
    const active = [...(reaction?.users ?? [])].some(r => r.username === me)
    return {
      active,
      count: reaction?.users.size ?? 0,
      decorated: reaction?.decorated ?? '',
    }
  }, shallowEqual)

  const dispatch = Container.useDispatch()
  const onAddReaction = React.useCallback(
    (emoji: string) => {
      dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal}))
    },
    [dispatch, conversationIDKey, ordinal]
  )
  const onClick = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji: emoji || '', ordinal}))
  }, [dispatch, emoji, ordinal, conversationIDKey])
  const onOpenEmojiPicker = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, onPickAddToMessageOrdinal: ordinal}, selected: 'chatChooseEmoji'}],
      })
    )
  }, [dispatch, ordinal, conversationIDKey])

  return emoji ? (
    <ReactButton
      active={active}
      className={className}
      count={count}
      getAttachmentRef={getAttachmentRef}
      emoji={emoji}
      decorated={decorated}
      onClick={onClick}
      onLongPress={onLongPress}
      style={style}
    />
  ) : (
    <NewReactionButton
      getAttachmentRef={getAttachmentRef}
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
