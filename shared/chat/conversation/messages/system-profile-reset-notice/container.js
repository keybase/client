// @noflow
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ProfileResetNotice from '.'
import {connect, type TypedState} from '../../../../util/container'
import {type StateProps, type DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    throw new Error('no selected conversation')
  }
  const supersedes = null // TODO Constants.convSupersedesInfo(selectedConversationIDKey, state.chat)
  if (!supersedes) {
    throw new Error('Missing supersedes')
  }

  return {
    prevConversationIDKey: supersedes.conversationIDKey,
    username: supersedes.finalizeInfo.resetUser,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpenOlderConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true})),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onOpenOlderConversation: () => dispatchProps._onOpenOlderConversation(stateProps.prevConversationIDKey),
  username: stateProps.username,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ProfileResetNotice)
