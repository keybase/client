// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import ProfileResetNotice from '.'
import {compose} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {StateProps, DispatchProps} from './container'

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
  onOpenConversation: (conversationIDKey: Constants.ConversationIDKey) => dispatch(Creators.openConversation(conversationIDKey)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps) => ({
  onOpenOlderConversation: () => { dispatchProps.onOpenConversation(stateProps.prevConversationIDKey) },
  username: stateProps.username,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(ProfileResetNotice)
