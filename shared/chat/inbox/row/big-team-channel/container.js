// @flow
import * as Selectors from '../selectors'
import * as Creators from '../../../../actions/chat/creators'
import {BigTeamChannel} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey, channelname}) => {
  const p = Selectors.snippetRowSelector(state, conversationIDKey)
  return {
    channelname,
    hasBadge: p.hasBadge,
    hasUnread: p.hasUnread,
    isMuted: p.isMuted,
    isSelected: p.isSelected,
    showBold: p.showBold,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Creators.setInboxFilter(''))
    dispatch(Creators.selectConversation(conversationIDKey, true))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  channelname: stateProps.channelname,
  hasBadge: stateProps.hasBadge,
  hasUnread: stateProps.hasUnread,
  isActiveRoute: ownProps.isActiveRoute,
  isMuted: stateProps.isMuted,
  isSelected: stateProps.isSelected,
  onSelectConversation: dispatchProps.onSelectConversation,
  showBold: stateProps.showBold,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamChannel)
