import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouterConstants from '../../../../constants/router2'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
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

const getEmojis = (state: Container.TypedState) => state.chat2.userReacjis.topReacjis.slice(0, 5)
const EmojiRowContainer = React.memo(function EmojiRowContainer(p: OwnProps) {
  const {className, onShowingEmojiPicker, style, tooltipPosition} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const {hasUnfurls, type} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const hasUnfurls = (m?.unfurls?.size ?? 0) > 0
    const type = m?.type
    return {hasUnfurls, type}
  }, shallowEqual)

  const emojis = Container.useSelector(getEmojis, shallowEqual)
  const dispatch = Container.useDispatch()

  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onForward = React.useCallback(() => {
    navigateAppend({props: {ordinal, srcConvID: conversationIDKey}, selected: 'chatForwardMsgPick'})
  }, [navigateAppend, conversationIDKey, ordinal])
  const onReact = React.useCallback(
    (emoji: string) => {
      dispatch(Chat2Gen.createToggleMessageReaction({conversationIDKey, emoji, ordinal}))
    },
    [dispatch, conversationIDKey, ordinal]
  )
  const onReply = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])

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
