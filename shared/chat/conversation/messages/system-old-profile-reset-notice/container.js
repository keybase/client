// @flow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import OldProfileResetNotice from '.'
import {connect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    _participants: meta.participants,
    nextConversationIDKey: meta.supersededBy,
    username: meta.wasFinalizedBy || '',
  }
}

const mapDispatchToProps = (dispatch) => ({
  onOpenConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'jumpFromReset'})),
  startConversation: (participants: Array<string>) =>
    dispatch(Chat2Gen.createPreviewConversation({participants, reason: 'fromAReset'})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const nextConversationIDKey = stateProps.nextConversationIDKey

  return {
    onOpenNewerConversation: nextConversationIDKey
      ? () => dispatchProps.onOpenConversation(nextConversationIDKey)
      : () => dispatchProps.startConversation(stateProps._participants.toArray()),
    username: stateProps.username,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(OldProfileResetNotice)
