// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {FilterSmallTeam} from '.'
import {connect, type TypedState} from '../../../../util/container'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey

  return {
    _meta: Constants.getMeta(state, conversationIDKey),
    _username: state.config.username || '',
    hasBadge: Constants.getHasBadge(state, conversationIDKey),
    hasUnread: Constants.getHasUnread(state, conversationIDKey),
    isSelected: Constants.getSelectedConversation(state) === conversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const styles = Constants.getRowStyles(stateProps._meta, isSelected, hasUnread)
  const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)

  return {
    backgroundColor: styles.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasUnread,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participantNeedToRekey,
    participants: Constants.getRowParticipants(stateProps._meta, stateProps._username).toArray(),
    showBold: styles.showBold,
    subColor: styles.subColor,
    teamname: stateProps._meta.teamname,
    usernameColor: styles.usernameColor,
    youNeedToRekey,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterSmallTeam)
