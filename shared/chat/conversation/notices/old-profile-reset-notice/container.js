// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import OldProfileResetNotice from '.'
import {List} from 'immutable'
import {compose, branch, renderNothing} from 'recompose'
import {connect} from 'react-redux'

import type {TypedState} from '../../../../constants/reducer'
import type {StateProps, DispatchProps} from './container'

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  if (!selectedConversationIDKey) {
    return {}
  }
  const finalizeInfo = state.chat.get('finalizedState').get(selectedConversationIDKey)
  const _supersededBy = Constants.convSupersededByInfo(selectedConversationIDKey, state.chat)

  const inbox = state.chat.get('inbox')
  const selected =
    inbox && inbox.find(inbox => inbox.get('conversationIDKey') === selectedConversationIDKey)
  const _participants = (selected && selected.participants) || List()

  return {
    _participants,
    _supersededBy,
    username: finalizeInfo.resetUser,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenConversation: (conversationIDKey: Constants.ConversationIDKey) =>
    dispatch(Creators.openConversation(conversationIDKey)),
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
