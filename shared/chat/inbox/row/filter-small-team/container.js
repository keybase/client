// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants2 from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as util from '../util'
import {FilterSmallTeam} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

type OwnProps = {conversationIDKey: ?Types.ConversationIDKey, isActiveRoute: boolean}
const emptyMeta = Constants2.makeConversationMeta()

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey || ''
  const {isActiveRoute} = ownProps
  const p = util.snippetRowSelector(state, conversationIDKey)

  // const meta = state.chat2.metaMap.get(conversationIDKey, emptyMeta)
  // const hasBadge = state.chat2.badgeMap.get(conversationIDKey, 0) > 0
  // const hasUnread = state.chat2.unreadMap.get(conversationIDKey, 0) > 0
  // const isSelected = state.chat2.selectedConversation === conversationIDKey

  return {
    _meta: (conversationIDKey && Constants2.getMeta(state, conversationIDKey)) || emptyMeta,
    _username: state.config.username || '',
    hasBadge: Constants2.getHasBadge(state, conversationIDKey),
    hasUnread: Constants2.getHasUnread(state, conversationIDKey),
    isActiveRoute,
    isSelected: Constants2.getIsSelected(state, conversationIDKey),
    participantNeedToRekey: p.participantNeedToRekey,
    participants: p.participants,
    youNeedToRekey: p.youNeedToRekey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    // TODO move to saga
    dispatch(Chat2Gen.createSetInboxFilter({filter: ''}))
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const derivedProps = Constants2.getRowColors(stateProps._meta, isSelected, hasUnread)

  return {
    backgroundColor: derivedProps.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasUnread,
    isActiveRoute: ownProps.isActiveRoute,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participantNeedToRekey: stateProps.participantNeedToRekey,
    participants: Constants2.getRowParticipants(stateProps._meta, stateProps._username),
    showBold: derivedProps.showBold,
    subColor: derivedProps.subColor,
    teamname: stateProps._meta.teamname,
    usernameColor: derivedProps.usernameColor,
    youNeedToRekey: stateProps.youNeedToRekey,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterSmallTeam)
