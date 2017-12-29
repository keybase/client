// @flow
import * as util from '../util'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {BigTeamChannel} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey, channelname, isActiveRoute}) => {
  const p = util.snippetRowSelector(state, conversationIDKey)
  // TODO error
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
    // TODO handle this in a saga
    dispatch(Chat2Gen.createSetInboxFilter({filter: ''}))
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true}))
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
