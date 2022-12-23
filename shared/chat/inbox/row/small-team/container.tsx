import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import type * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  isTeam: boolean
  navKey: string
  name: string
  selected: boolean
  snippet?: string
  time: number
  swipeCloseRef?: React.MutableRefObject<(() => void) | null>
}

const SmallTeamContainer = (p: OwnProps) => {
  const {conversationIDKey, selected, swipeCloseRef, isTeam, name, time} = p
  const layoutIsTeam = isTeam
  const layoutName = name
  const _meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const youAreReset = _meta.membershipType === 'youAreReset'
  let snippet: string = Container.useSelector(state =>
    state.chat2.metaMap.get(conversationIDKey) ? _meta.snippetDecorated : p.snippet || ''
  )
  const participantNeedToRekey = _meta.rekeyers.size > 0
  const _username = Container.useSelector(state => state.config.username)
  const hasUnread = Container.useSelector(state => Constants.getHasUnread(state, conversationIDKey))

  const isDecryptingSnippet = Container.useSelector(state => {
    if (!snippet) {
      const trustedState = state.chat2.metaMap.get(conversationIDKey)?.trustedState
      return !trustedState || trustedState === 'requesting' || trustedState === 'untrusted'
    }
    return false
  })

  const teamname = _meta.teamname ? _meta.teamname : layoutIsTeam ? layoutName : ''

  const isMuted = Container.useSelector(state => Constants.isMuted(state, conversationIDKey))

  const hasResetUsers = _meta.resetParticipants.size !== 0
  const isSelected = selected
  const youNeedToRekey = !!participantNeedToRekey && _meta.rekeyers.has(_username)

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
    // TODO
    hasBottomLine:
      youAreReset ||
      participantNeedToRekey ||
      isDecryptingSnippet ||
      !!snippet ||
      youNeedToRekey ||
      hasResetUsers,
    hasUnread,
    isDecryptingSnippet,
    isInWidget: false,
    isMuted,
    isSelected,
    layoutIsTeam,
    layoutName,
    layoutSnippet: p.snippet,
    layoutTime: time,
    onHideConversation,
    onMuteConversation,
    // Don't allow you to select yourself
    onSelectConversation: isSelected ? undefined : onSelectConversation,
    participantNeedToRekey,
    swipeCloseRef,
    teamname,
  }
  return <SmallTeam {...props} />
}

export default SmallTeamContainer
