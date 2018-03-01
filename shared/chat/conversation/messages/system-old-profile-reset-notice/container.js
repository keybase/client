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
    username: meta.supersededByCausedBy || '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey})),
  startConversation: (participants: Array<string>) =>
    dispatch(Chat2Gen.createStartConversation({forceImmediate: true, participants})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onOpenNewerConversation: stateProps.nextConversationIDKey
    ? () => dispatchProps.onOpenConversation(stateProps.nextConversationIDKey)
    : () => dispatchProps.startConversation(stateProps._participants.toArray()),
  username: stateProps.username,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(OldProfileResetNotice)
