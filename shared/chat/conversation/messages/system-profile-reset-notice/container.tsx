import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ProfileResetNotice from '.'
import {connect} from '../../../../util/container'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

export default connect(
  (state, {conversationIDKey}: OwnProps) => {
    const meta = Constants.getMeta(state, conversationIDKey)
    return {
      prevConversationIDKey: meta.supersedes,
      username: meta.wasFinalizedBy || '',
    }
  },
  dispatch => ({
    _onOpenOlderConversation: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'jumpToReset'})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    onOpenOlderConversation: () => {
      stateProps.prevConversationIDKey &&
        dispatchProps._onOpenOlderConversation(stateProps.prevConversationIDKey)
    },
    username: stateProps.username,
  })
)(ProfileResetNotice)
