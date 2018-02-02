// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import {connect, type TypedState} from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'

type SwitchProps = {
  conversationIDKey: Types.ConversationIDKey,
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
      return this.props.conversationIDKey && <Error conversationIDKey={this.props.conversationIDKey} />
    }
    return <Normal conversationIDKey={this.props.conversationIDKey} />
  }
}

const mapStateToProps = (state: TypedState): * => {
  let _conversationIDKey
  let _pendingConversationUsers

  if (state.chat2.pendingSelected) {
    _pendingConversationUsers = state.chat2.pendingConversationUsers
  } else {
    _conversationIDKey = Constants.getSelectedConversation(state)
  }

  return {
    _conversationIDKey,
    _metaMap: state.chat2.metaMap,
    _pendingConversationUsers,
    _you: state.config.username || '',
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  let showError = false
  let showNoConvo = false
  let conversationIDKey = stateProps._conversationIDKey

  if (conversationIDKey) {
    showError = stateProps._metaMap.getIn([conversationIDKey, 'trustedState']) === 'error'
  } else if (stateProps._pendingConversationUsers) {
    conversationIDKey = Constants.getExistingConversationWithUsers(
      stateProps._pendingConversationUsers,
      stateProps._you,
      stateProps._metaMap
    )
  } else {
    showNoConvo = true
  }

  return {
    conversationIDKey: conversationIDKey || Types.stringToConversationIDKey(''), // we pass down conversationIDKey so this can be calculated once and also this lets us have chat things in other contexts so we can theoretically show multiple chats at the same time (like in a modal)
    showError,
    showNoConvo,
    showRekey: false, // TODO
  }
}

export default connect(mapStateToProps, () => ({}), mergeProps)(Conversation)
