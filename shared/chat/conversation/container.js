// @flow
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Types from '../../constants/types/chat2'
import * as Flow from '../../util/flow'
import {isMobile, isIOS} from '../../constants/platform'
import {connect, getRouteProps} from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import flags from '../../util/feature-flags'

type OwnProps = {|
  navigation?: any,
|}

type SwitchProps = {
  conversationIDKey: Types.ConversationIDKey,
  isFocused?: boolean,
  selectConversation: () => void,
  deselectConversation: () => void,
  type: 'error' | 'noConvo' | 'rekey' | 'youAreReset' | 'normal' | 'rekey',
}

let NavigationEvents
if (flags.useNewRouter) {
  NavigationEvents = require('@react-navigation/core').NavigationEvents
} else {
  NavigationEvents = () => null
}

class Conversation extends React.PureComponent<SwitchProps> {
  _onDidFocus = () => {
    this.props.selectConversation()
  }
  _onWillBlur = () => {
    this.props.deselectConversation()
  }
  componentWillUnmount() {
    // Workaround
    // https://github.com/react-navigation/react-navigation/issues/5669
    // Covers the case of swiping back on iOS
    if (isIOS) {
      this.props.deselectConversation()
    }
  }

  render() {
    switch (this.props.type) {
      case 'error':
        return <Error conversationIDKey={this.props.conversationIDKey} />
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
        return (
          <>
            {isMobile && <NavigationEvents onDidFocus={this._onDidFocus} onWillBlur={this._onWillBlur} />}
            <Normal conversationIDKey={this.props.conversationIDKey} />
          </>
        )
      case 'youAreReset':
        return <YouAreReset />
      case 'rekey':
        return <Rekey conversationIDKey={this.props.conversationIDKey} />
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(this.props.type)
        return <NoConversation />
    }
  }
}

const mapStateToProps = (state, ownProps) => {
  let _storeConvoIDKey = Constants.getSelectedConversation(state)
  const conversationIDKey =
    flags.useNewRouter && isMobile ? getRouteProps(ownProps, 'conversationIDKey') : _storeConvoIDKey
  let _meta = Constants.getMeta(state, conversationIDKey)

  return {
    _meta,
    _storeConvoIDKey,
    conversationIDKey,
  }
}

const mapDispatchToProps = dispatch => ({
  _deselectConversation: ifConversationIDKey =>
    dispatch(
      Chat2Gen.createDeselectConversation({
        ifConversationIDKey,
      })
    ),
  _selectConversation: conversationIDKey =>
    dispatch(
      Chat2Gen.createSelectConversation({
        conversationIDKey,
        reason: 'focused',
      })
    ),
})

const mergeProps = (stateProps, dispatchProps) => {
  let type
  switch (stateProps.conversationIDKey) {
    case Constants.noConversationIDKey:
      type = 'noConvo'
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
    deselectConversation:
      !flags.useNewRouter || stateProps._storeConvoIDKey !== stateProps.conversationIDKey
        ? () => {}
        : () => dispatchProps._deselectConversation(stateProps.conversationIDKey),
    selectConversation:
      !flags.useNewRouter || stateProps._storeConvoIDKey === stateProps.conversationIDKey
        ? () => {} // ignore if already selected or pending
        : () => dispatchProps._selectConversation(stateProps.conversationIDKey),
    type,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Conversation)
