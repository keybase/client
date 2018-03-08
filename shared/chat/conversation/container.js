// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import {connect, type TypedState} from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'

type SwitchProps = {
  conversationIDKey: Types.ConversationIDKey,
  type: 'error' | 'noConvo' | 'rekey' | 'youAreReset' | 'normal' | 'rekey',
}

class Conversation extends React.PureComponent<SwitchProps> {
  render() {
    switch (this.props.type) {
      case 'error':
        return this.props.conversationIDKey && <Error conversationIDKey={this.props.conversationIDKey} />
      case 'noConvo':
        return <NoConversation />
      case 'normal':
        return <Normal conversationIDKey={this.props.conversationIDKey} />
      case 'youAreReset':
        return <YouAreReset />
      case 'rekey':
        return <Rekey conversationIDKey={this.props.conversationIDKey} />
      default:
        // eslint-disable-next-line no-unused-expressions
        ;(this.props.type: empty) // if you get a flow error here it means there's a missing case
        return <NoConversation />
    }
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
  let conversationIDKey = stateProps._conversationIDKey

  let type = 'noConvo'
  if (conversationIDKey) {
    if (stateProps._metaMap.getIn([conversationIDKey, 'trustedState']) === 'error') {
      type = 'error'
    } else if (stateProps._metaMap.getIn([conversationIDKey, 'membershipType']) === 'youAreReset') {
      type = 'youAreReset'
    } else if (stateProps._metaMap.getIn([conversationIDKey, 'rekeyers'], I.Set()).size > 0) {
      type = 'rekey'
    } else {
      type = 'normal'
    }
  } else if (stateProps._pendingConversationUsers) {
    conversationIDKey = Constants.getExistingConversationWithUsers(
      stateProps._pendingConversationUsers,
      stateProps._you,
      stateProps._metaMap
    )
    type = 'normal'
  } else {
    type = 'noConvo'
  }

  return {
    conversationIDKey: conversationIDKey || Types.stringToConversationIDKey(''), // we pass down conversationIDKey so this can be calculated once and also this lets us have chat things in other contexts so we can theoretically show multiple chats at the same time (like in a modal)
    type,
  }
}

export default connect(mapStateToProps, () => ({}), mergeProps)(Conversation)
