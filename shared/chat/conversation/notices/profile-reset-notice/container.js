// @flow
import * as Constants from '../../../../constants/chat'
import * as Types from '../../../../constants/types/chat'
import * as ChatGen from '../../../../actions/chat-gen'
import ProfileResetNotice from '.'
import {connect, type TypedState} from '../../../../util/container'
import {type StateProps, type DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    throw new Error('no selected conversation')
  }
  const supersedes = Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
  if (!supersedes) {
    throw new Error('Missing supersedes')
  }

  return {
    prevConversationIDKey: supersedes.conversationIDKey,
    username: supersedes.finalizeInfo.resetUser,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(ChatGen.createOpenConversation({conversationIDKey})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onOpenOlderConversation: () => {
    dispatchProps.onOpenConversation(stateProps.prevConversationIDKey)
  },
  username: stateProps.username,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ProfileResetNotice)
