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
  const _meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const isEmptyMeta = _meta.conversationIDKey !== conversationIDKey
  const youAreReset = _meta.membershipType === 'youAreReset'
  const typers = Container.useSelector(state => state.chat2.typingMap.get(conversationIDKey))
  let snippet: string = Container.useSelector(state =>
    state.chat2.metaMap.get(conversationIDKey) ? _meta.snippetDecorated : p.snippet || ''
  )
  // valid meta or empty?
  let isTypingSnippet = false
  if (typers && typers.size > 0) {
    isTypingSnippet = true
    snippet =
      typers.size === 1
        ? `${typers.values().next().value as string} is typing...`
        : 'Multiple people typing...'
  }
  const _participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const participantNeedToRekey = _meta.rekeyers.size > 0
  const _username = Container.useSelector(state => state.config.username)
  const hasUnread = Container.useSelector(state => Constants.getHasUnread(state, conversationIDKey))
  const isDecryptingSnippet =
    (hasUnread || snippet.length === 0) && Constants.isDecryptingSnippet(_meta.trustedState) && isEmptyMeta

  const teamname = _meta.teamname ? _meta.teamname : isTeam ? name : ''

  const _draft = Container.useSelector(state => Constants.getDraft(state, conversationIDKey))
  const isMuted = Container.useSelector(state => Constants.isMuted(state, conversationIDKey))

  const hasResetUsers = _meta.resetParticipants.size !== 0
  const isSelected = selected
  const isFinalized = !!_meta.wasFinalizedBy
  const youNeedToRekey = !participantNeedToRekey && _meta.rekeyers.has(_username)

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

  const participantsArray = _participantInfo.all.length
    ? Constants.getRowParticipants(_participantInfo, _username)
    : !isTeam
    ? name.split(',')
    : [name]

  const participants = participantsArray

  const props = {
    conversationIDKey,
    draft: _draft && !isSelected && !hasUnread ? _draft : undefined,
    hasBottomLine:
      youAreReset ||
      participantNeedToRekey ||
      isDecryptingSnippet ||
      !!snippet ||
      youNeedToRekey ||
      hasResetUsers,
    hasUnread,
    isDecryptingSnippet,
    isFinalized,
    isInWidget: false,
    isMuted,
    isSelected,
    isTeam,
    isTypingSnippet,
    layoutIsTeam: isTeam,
    layoutName: name,
    layoutSnippet: p.snippet,
    name,
    onHideConversation,
    onMuteConversation,
    // Don't allow you to select yourself
    onSelectConversation: isSelected ? undefined : onSelectConversation,
    participantNeedToRekey,
    participants,
    snippet,
    swipeCloseRef,
    teamname,
    time,
    youNeedToRekey,
  }
  return <SmallTeam {...props} />
}

export default SmallTeamContainer
