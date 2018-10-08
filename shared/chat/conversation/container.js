// @flow
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Types from '../../constants/types/chat2'
import {isMobile} from '../../styles'
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

const DONT_RENDER_CONVERSATION = __DEV__ && false

class Conversation extends React.PureComponent<SwitchProps> {
  render() {
    if (DONT_RENDER_CONVERSATION) {
      return <NoConversation />
    }
    switch (this.props.type) {
      case 'error':
        return this.props.conversationIDKey && <Error conversationIDKey={this.props.conversationIDKey} />
      case 'noConvo':
        // When navigating back to the inbox on mobile, we delelect
        // conversationIDKey by called mobileChangeSelection. This results in
        // the conversation view rendering "NoConversation" as it is
        // transitioning back the the inbox.
        // On android this is very noticable because transitions fade between
        // screens, so "NoConversation" will appear on top of the inbox for
        // approximately 150ms.
        // On iOS it is less noticable because screen transitions slide away to
        // the right, though it is visible for a small amount of time.
        // To solve this we render a blank screen on mobile conversation views with "noConvo"
        return isMobile ? null : <NoConversation />
      case 'normal':
        return <Normal conversationIDKey={this.props.conversationIDKey} />
      case 'youAreReset':
        return <YouAreReset />
      case 'rekey':
        return <Rekey conversationIDKey={this.props.conversationIDKey} />
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(this.props.type);
      */
        return <NoConversation />
    }
  }
}

const mapStateToProps = (state: TypedState) => {
  let conversationIDKey = Constants.getSelectedConversation(state)
  let _meta = Constants.getMeta(state, conversationIDKey)

  return {
    _meta,
    conversationIDKey,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  let type
  switch (stateProps.conversationIDKey) {
    case Constants.noConversationIDKey:
      type = 'noConvo'
      break
    case Constants.pendingConversationIDKey:
      type = 'normal'
      break
    default:
      if (stateProps._meta.membershipType === 'youAreReset') {
        type = 'youAreReset'
      } else if (stateProps._meta.rekeyers.size > 0) {
        type = 'rekey'
      } else if (stateProps._meta.trustedState === 'error') {
        type = 'error'
      } else {
        type = 'normal'
      }
  }

  return {
    conversationIDKey: stateProps.conversationIDKey, // we pass down conversationIDKey so this can be calculated once and also this lets us have chat things in other contexts so we can theoretically show multiple chats at the same time (like in a modal)
    type,
  }
}

export default connect(
  mapStateToProps,
  () => ({}),
  mergeProps
)(Conversation)
