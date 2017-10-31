// @flow
import * as Selectors from '../selectors'
import * as ChatGen from '../../../../actions/chat-gen'
import {BigTeamChannel} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey, channelname, isActiveRoute}) => {
  const p = Selectors.snippetRowSelector(state, conversationIDKey)
  return {
    channelname,
    hasBadge: p.hasBadge,
    hasUnread: p.hasUnread,
    isActiveRoute,
    isMuted: p.isMuted,
    isSelected: p.isSelected,
    showBold: p.showBold,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(ChatGen.createSetInboxFilter({filter: ''}))
    dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname,
  hasBadge: stateProps.hasBadge,
  hasUnread: stateProps.hasUnread,
  isActiveRoute: stateProps.isActiveRoute,
  isMuted: stateProps.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  showBold: stateProps.showBold,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamChannel)
