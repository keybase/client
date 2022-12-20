import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import OldProfileResetNotice from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default Container.connect(
  (state, {conversationIDKey}: OwnProps) => {
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const meta = Constants.getMeta(state, conversationIDKey)
    return {
      _participants: participantInfo.all,
      nextConversationIDKey: meta.supersededBy,
      username: meta.wasFinalizedBy || '',
    }
  },
  dispatch => ({
    onOpenConversation: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'jumpFromReset'})),
    startConversation: (participants: Array<string>) =>
      dispatch(Chat2Gen.createPreviewConversation({participants, reason: 'fromAReset'})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {nextConversationIDKey, _participants, username} = stateProps
    return {
      onOpenNewerConversation: nextConversationIDKey
        ? () => dispatchProps.onOpenConversation(nextConversationIDKey)
        : () => dispatchProps.startConversation(_participants),
      username,
    }
  }
)(OldProfileResetNotice)
