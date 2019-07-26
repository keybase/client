import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Types from '../../constants/types/chat2'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

type SwitchProps = {
  conversationIDKey: Types.ConversationIDKey
  isFocused?: boolean
  selectConversation: () => void
  deselectConversation: () => void
  type: 'error' | 'noConvo' | 'rekey' | 'youAreReset' | 'normal' | 'rekey'
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
    if (Container.isIOS) {
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
        return Container.isMobile ? null : <NoConversation />
      case 'normal':
        return (
          <>
            {Container.isMobile && (
              <Kb.NavigationEvents onDidFocus={this._onDidFocus} onWillBlur={this._onWillBlur} />
            )}
            <Normal conversationIDKey={this.props.conversationIDKey} />
          </>
        )
      case 'youAreReset':
        return <YouAreReset />
      case 'rekey':
        return <Rekey conversationIDKey={this.props.conversationIDKey} />
      default:
        return <NoConversation />
    }
  }
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    let _storeConvoIDKey = Constants.getSelectedConversation(state)
    const conversationIDKey = Container.isMobile
      ? Container.getRouteProps(ownProps, 'conversationIDKey', Constants.noConversationIDKey)
      : _storeConvoIDKey
    let _meta = Constants.getMeta(state, conversationIDKey)

    return {
      _meta,
      _storeConvoIDKey,
      conversationIDKey,
    }
  },
  dispatch => ({
    _deselectConversation: ifConversationIDKey =>
      dispatch(Chat2Gen.createDeselectConversation({ifConversationIDKey})),
    _selectConversation: conversationIDKey =>
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'focused'})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
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
        stateProps._storeConvoIDKey !== stateProps.conversationIDKey
          ? () => {}
          : () => dispatchProps._deselectConversation(stateProps.conversationIDKey),
      selectConversation:
        stateProps._storeConvoIDKey === stateProps.conversationIDKey
          ? () => {} // ignore if already selected or pending
          : () => dispatchProps._selectConversation(stateProps.conversationIDKey),
      type,
    }
  }
)(Conversation)
