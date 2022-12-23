import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import type * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  layoutIsTeam: boolean
  layoutName: string
  isSelected: boolean
  layoutSnippet?: string
  layoutTime: number
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}

const SmallTeamContainer = (p: OwnProps) => {
  const {conversationIDKey, isSelected, swipeCloseRef, layoutIsTeam, layoutName, layoutTime, layoutSnippet} =
    p
  const _meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  let snippet: string = Container.useSelector(state =>
    state.chat2.metaMap.get(conversationIDKey) ? _meta.snippetDecorated : layoutSnippet || ''
  )
  const hasUnread = Container.useSelector(state => Constants.getHasUnread(state, conversationIDKey))

  const isDecryptingSnippet = Container.useSelector(state => {
    if (!snippet) {
      const trustedState = state.chat2.metaMap.get(conversationIDKey)?.trustedState
      return !trustedState || trustedState === 'requesting' || trustedState === 'untrusted'
    }
    return false
  })

  const isMuted = Container.useSelector(state => Constants.isMuted(state, conversationIDKey))

  const dispatch = Container.useDispatch()
  const onHideConversation = React.useCallback(() => {
    dispatch(Chat2Gen.createHideConversation({conversationIDKey}))
  }, [dispatch, conversationIDKey])
  const onMuteConversation = React.useCallback(() => {
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: !isMuted}))
  }, [dispatch, conversationIDKey, isMuted])
  const onSelectConversation = React.useCallback(() => {
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSmall'}))
  }, [dispatch, conversationIDKey])

  const props = {
    conversationIDKey,
    hasUnread,
    isDecryptingSnippet,
    isInWidget: false,
    isMuted,
    isSelected,
    layoutIsTeam,
    layoutName,
    layoutSnippet,
    layoutTime,
    onHideConversation,
    onMuteConversation,
    // Don't allow you to select yourself
    onSelectConversation: isSelected ? undefined : onSelectConversation,
    swipeCloseRef,
  }
  return <SmallTeam {...props} />
}

export default SmallTeamContainer
