// @flow
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {BigTeamChannel} from '.'
import {connect, type TypedState, isMobile} from '../../../../util/container'

const mapStateToProps = (state: TypedState, ownProps) => {
  const _conversationIDKey = ownProps.conversationIDKey

  return {
    _meta: Constants.getMeta(state, _conversationIDKey),
    hasBadge: Constants.getHasBadge(state, _conversationIDKey),
    hasUnread: Constants.getHasUnread(state, _conversationIDKey),
    isSelected: !isMobile && Constants.getSelectedConversation(state) === _conversationIDKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxBig'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: ownProps.channelname,
  hasBadge: stateProps.hasBadge,
  hasUnread: stateProps.hasUnread,
  isError: stateProps._meta.trustedState === 'error',
  isMuted: stateProps._meta.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  showBold: Constants.getRowStyles(stateProps._meta, false, false).showBold,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamChannel)
