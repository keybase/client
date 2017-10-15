// @flow
import * as Selectors from '../selectors'
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import {SmallTeam} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const getSnippet = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) =>
  Constants.getSnippet(state, conversationIDKey)

const mapStateToProps = (state: TypedState, {conversationIDKey, channelname, teamname, isActiveRoute}) => {
  const p = Selectors.snippetRowSelector(state, conversationIDKey)

  return {
    backgroundColor: p.backgroundColor,
    channelname,
    hasBadge: p.hasBadge,
    hasUnread: p.hasUnread,
    isActiveRoute,
    isMuted: p.isMuted,
    isSelected: p.isSelected,
    participantNeedToRekey: p.participantNeedToRekey,
    participants: p.participants,
    showBold: p.showBold,
    snippet: getSnippet(state, conversationIDKey || ''),
    subColor: p.subColor,
    teamname,
    timestamp: p.timestamp,
    usernameColor: p.usernameColor,
    youNeedToRekey: p.youNeedToRekey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Creators.setInboxFilter(''))
    dispatch(Creators.selectConversation(conversationIDKey, true))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  backgroundColor: stateProps.backgroundColor,
  hasBadge: stateProps.hasBadge,
  hasUnread: stateProps.hasUnread,
  isActiveRoute: ownProps.isActiveRoute,
  isMuted: stateProps.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  participantNeedToRekey: stateProps.participantNeedToRekey,
  participants: stateProps.participants,
  showBold: stateProps.showBold,
  snippet: stateProps.snippet,
  subColor: stateProps.subColor,
  teamname: stateProps.teamname || '',
  timestamp: stateProps.timestamp,
  usernameColor: stateProps.usernameColor,
  youNeedToRekey: stateProps.youNeedToRekey,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
