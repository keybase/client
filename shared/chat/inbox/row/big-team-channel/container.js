// @flow
import * as Constants2 from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {BigTeamChannel} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, ownProps) => {
  const _conversationIDKey = ownProps.conversationIDKey || ''
  const {isActiveRoute} = ownProps

  return {
    _meta: Constants2.getMeta(state, _conversationIDKey),
    hasBadge: Constants2.getHasBadge(state, _conversationIDKey),
    hasUnread: Constants2.getHasUnread(state, _conversationIDKey),
    isActiveRoute,
    isSelected: Constants2.getIsSelected(state, _conversationIDKey),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname:
    stateProps._meta.trustedState === 'error'
      ? stateProps._meta.untrustedMessage
      : ownProps.channelname || stateProps._meta.untrustedMessage,
  hasBadge: stateProps.hasBadge,
  hasUnread: stateProps.hasUnread,
  isActiveRoute: stateProps.isActiveRoute,
  isError: !ownProps.channelname && !!stateProps._meta.untrustedMessage,
  isMuted: stateProps._meta.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  showBold: Constants2.getRowStyles(stateProps._meta, false, false).showBold,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamChannel)
