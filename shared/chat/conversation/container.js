// @flow
import * as React from 'react'
import * as Constants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Types from '../../constants/types/chat2'
import * as Flow from '../../util/flow'
import {isMobile} from '../../styles'
import {connect, getRouteProps} from '../../util/container'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import flags from '../../util/feature-flags'

type OwnProps = {||}

type SwitchProps = {
  conversationIDKey: Types.ConversationIDKey,
  isPending: boolean,
  isFocused?: boolean,
  selectConversation: () => void,
  deselectConversation: () => void,
  type: 'error' | 'noConvo' | 'rekey' | 'youAreReset' | 'normal' | 'rekey',
}

const DONT_RENDER_CONVERSATION = __DEV__ && false

class ConversationImpl extends React.PureComponent<SwitchProps> {
  _handleSelectionChange = () => {
    if (this.props.isFocused) {
      this.props.selectConversation()
    } else {
      // need to defer this so we don't race if we're clicking between two chats on 2 tabs. TODO think of a better way to make this safe
      setTimeout(this.props.deselectConversation, 100)
    }
  }
  componentWillMount() {
    this._handleSelectionChange()
  }
  componentDidUpdate(prevProps: SwitchProps) {
    if (
      this.props.isFocused !== prevProps.isFocused ||
      this.props.conversationIDKey !== prevProps.conversationIDKey
    ) {
      this._handleSelectionChange()
    }
  }

  render() {
    if (DONT_RENDER_CONVERSATION) {
      return <NoConversation />
    }
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
        return <Normal conversationIDKey={this.props.conversationIDKey} isPending={this.props.isPending} />
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

let Conversation
if (flags.useNewRouter) {
  const {withNavigationFocus} = require('@react-navigation/core')
  Conversation = withNavigationFocus(ConversationImpl)
} else {
  Conversation = ConversationImpl
}

const mapStateToProps = (state, ownProps) => {
  let _storeConvoIDKey = Constants.getSelectedConversation(state)
  let conversationIDKey
  if (flags.useNewRouter) {
    conversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
  } else {
    conversationIDKey = _storeConvoIDKey
  }
  let _meta = Constants.getMeta(state, conversationIDKey)
  let isPending = false

  // If its a pending thats been resolved, treat it as the resolved one and pass down pending as a boolean
  if (conversationIDKey === Constants.pendingConversationIDKey) {
    isPending = true
    const resolvedPendingConversationIDKey = Constants.getResolvedPendingConversationIDKey(state)
    if (Constants.isValidConversationIDKey(resolvedPendingConversationIDKey)) {
      conversationIDKey = resolvedPendingConversationIDKey
      // update route props
      if (flags.useNewRouter) {
        setTimeout(() => {
          // $FlowIssue
          ownProps.navigation.setParams('conversationIDKey', conversationIDKey)
        }, 1000)
      }
    }
  }

  return {
    _meta,
    _storeConvoIDKey,
    conversationIDKey,
    isPending,
  }
}

const mapDispatchToProps = dispatch => ({
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
    case Constants.pendingConversationIDKey:
      type = 'normal'
      break
    default:
      if (stateProps.isPending) {
        type = 'normal'
      } else if (stateProps._meta.membershipType === 'youAreReset') {
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
        : () => dispatchProps._selectConversation(Constants.noConversationIDKey),
    isPending: stateProps.isPending,
    selectConversation:
      !flags.useNewRouter ||
      stateProps._storeConvoIDKey === stateProps.conversationIDKey ||
      stateProps.conversationIDKey === Constants.pendingConversationIDKey
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
