// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import * as ChatGen from '../../../../actions/chat-gen'
import OldProfileResetNotice from '.'
import {List} from 'immutable'
import {compose, branch, renderNothing, connect, type TypedState} from '../../../../util/container'
import {type StateProps, type DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    // $FlowIssue this isn't typesafe
    return {}
  }
  const finalizeInfo = state.chat.finalizedState.get(selectedConversationIDKey)
  const _supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)
  const selected = Constants.getInbox(state, selectedConversationIDKey)
  const _participants = selected ? selected.participants : List()

  return {
    _participants,
    _supersededBy,
    username: finalizeInfo ? finalizeInfo.resetUser : '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenConversation: (conversationIDKey: Constants.ConversationIDKey) =>
    dispatch(ChatGen.createOpenConversation({conversationIDKey})),
  startConversation: (users: Array<string>) => dispatch(Creators.startConversation(users, true)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onOpenNewerConversation: stateProps._supersededBy
    ? () => {
        stateProps._supersededBy &&
          stateProps._supersededBy.conversationIDKey &&
          dispatchProps.onOpenConversation(stateProps._supersededBy.conversationIDKey)
      }
    : () => dispatchProps.startConversation(stateProps._participants.toArray()),
  username: stateProps.username,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => !props.username, renderNothing)
)(OldProfileResetNotice)
