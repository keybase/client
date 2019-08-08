import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {BigTeamChannel} from '.'
import {namedConnect, isMobile} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  channelname: string
}

export default namedConnect(
  (state, ownProps: OwnProps) => {
    const _conversationIDKey = ownProps.conversationIDKey
    return {
      _meta: Constants.getMeta(state, _conversationIDKey),
      hasBadge: Constants.getHasBadge(state, _conversationIDKey),
      hasUnread: Constants.getHasUnread(state, _conversationIDKey),
      isSelected: !isMobile && Constants.getSelectedConversation(state) === _conversationIDKey,
    }
  },
  (dispatch, {conversationIDKey}: OwnProps) => ({
    onSelectConversation: () =>
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxBig'})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    channelname: ownProps.channelname,
    hasBadge: stateProps.hasBadge,
    hasDraft: !!stateProps._meta.draft && !stateProps.isSelected,
    hasUnread: stateProps.hasUnread,
    isError: stateProps._meta.trustedState === 'error',
    isMuted: stateProps._meta.isMuted,
    isSelected: stateProps.isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    showBold: Constants.getRowStyles(stateProps._meta, false, false).showBold,
  }),
  'BigTeamChannel'
)(BigTeamChannel)
