// @flow
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import {connect, type TypedState} from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'

type SwitchProps = {
  showError: boolean,
  showNoConvo: boolean,
  showRekey: boolean,
}

class Conversation extends React.PureComponent<SwitchProps> {
  render() {
    if (this.props.showNoConvo) {
      return <NoConversation />
    }
    // if (this.props.showRekey) {
    // return <Rekey />
    // }
    if (this.props.showError) {
      return <Error />
    }
    return <Normal />
  }
}

const mapStateToProps = (state: TypedState): * => {
  const conversationIDKey = Constants.getSelectedConversation(state)

  // use this if pendingSelected
  // const selectConversationForPendingChanges = (
  // action: Chat2Gen.SetPendingSelectedPayload | Chat2Gen.SetPendingConversationUsersPayload,
  // state: TypedState
  // ) => {
  // let users
  // if (action.type === Chat2Gen.setPendingSelected) {
  // users = state.chat2.pendingConversationUsers.toArray()
  // } else if (action.type === Chat2Gen.setPendingConversationUsers) {
  // users = action.payload.users
  // }
  // const you = state.config.username

  // const toFind = I.Set(users.concat(you))
  // const conversationIDKey = state.chat2.metaMap.findKey(meta =>
  // // Ignore the order of participants
  // meta.participants.toSet().equals(toFind)
  // )

  // if (conversationIDKey) {
  // return Saga.sequentially([
  // Saga.put(
  // Chat2Gen.createSelectConversation({
  // conversationIDKey,
  // fromUser: false,
  // })
  // ),
  // ])
  // }
  // }

  return {
    showError: conversationIDKey && Constants.getMeta(state, conversationIDKey).trustedState === 'error',
    showNoConvo: !conversationIDKey && !state.chat2.pendingSelected,
    showRekey: false, // TODO
  }
}

export default connect(mapStateToProps)(Conversation)
