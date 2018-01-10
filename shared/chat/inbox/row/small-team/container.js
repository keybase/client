// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants2 from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import {pausableConnect, type TypedState, type Dispatch} from '../../../../util/container'

type OwnProps = {conversationIDKey: ?Types.ConversationIDKey, isActiveRoute: boolean}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const _conversationIDKey = ownProps.conversationIDKey || ''
  const {isActiveRoute} = ownProps
  const youAreReset = false // Constants.isResetConversationIDKey(state, _conversationIDKey)

  return {
    _conversationIDKey,
    _messageIDs: Constants2.getMessageOrdinals(state, _conversationIDKey),
    _messageMap: Constants2.getMessageMap(state, _conversationIDKey),
    _meta: Constants2.getMeta(state, _conversationIDKey),
    _username: state.config.username || '',
    hasBadge: Constants2.getHasBadge(state, _conversationIDKey),
    hasUnread: Constants2.getHasUnread(state, _conversationIDKey),
    isActiveRoute,
    isSelected: Constants2.getIsSelected(state, _conversationIDKey),
    youAreReset,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}: OwnProps) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const styles = Constants2.getRowStyles(stateProps._meta, isSelected, hasUnread)
  const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)

  return {
    backgroundColor: styles.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasResetUsers: !stateProps._meta.resetParticipants.isEmpty(),
    hasUnread,
    isActiveRoute: ownProps.isActiveRoute,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participantNeedToRekey,
    participants: Constants2.getRowParticipants(stateProps._meta, stateProps._username),
    showBold: styles.showBold,
    snippet: stateProps._meta.snippet,
    subColor: styles.subColor,
    teamname: stateProps._meta.teamname,
    timestamp: Constants2.timestampToString(stateProps._meta),
    usernameColor: styles.usernameColor,
    youAreReset: stateProps.youAreReset,
    youNeedToRekey,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
