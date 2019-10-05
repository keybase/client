import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {BigTeamChannel} from '.'
import {namedConnect, isMobile} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  channelname: string
  isMuted: boolean
  navKey: string
}

export default namedConnect(
  (state, ownProps: OwnProps) => {
    const _conversationIDKey = ownProps.conversationIDKey
    return {
      _meta: Constants.getMeta(state, _conversationIDKey),
      hasBadge: Constants.getHasBadge(state, _conversationIDKey),
      hasDraft: !!state.chat2.draftMap.get(_conversationIDKey),
      hasUnread: Constants.getHasUnread(state, _conversationIDKey),
      isSelected: !isMobile && Constants.getSelectedConversation(state) === _conversationIDKey,
    }
  },
  (dispatch, {conversationIDKey, navKey}: OwnProps) => ({
    onSelectConversation: () =>
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, navKey, reason: 'inboxBig'})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    channelname: stateProps._meta.channelname || ownProps.channelname,
    hasBadge: stateProps.hasBadge,
    hasDraft: stateProps.hasDraft && !stateProps.isSelected,
    hasUnread: stateProps.hasUnread,
    isError: stateProps._meta.trustedState === 'error',
    isMuted: ownProps.isMuted || stateProps._meta.isMuted,
    isSelected: stateProps.isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    showBold: Constants.getRowStyles(false, false).showBold,
  }),
  'BigTeamChannel'
)(BigTeamChannel)
