// @flow
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import SystemAddedToTeam from './system-added-to-team/container'
import SystemGitPush from './system-git-push/container'
import SystemInviteAccepted from './system-invite-accepted/container'
import SystemJoined from './system-joined/container'
import SystemLeft from './system-left/container'
import SystemSimpleToComplex from './system-simple-to-complex/container'
import SystemText from './system-text/container'
import SetDescription from './set-description/container'
import SetChannelname from './set-channelname/container'
import TextMessage from './text/container'
import AttachmentMessage from './attachment/container'
import PaymentMessage from './account-payment/container'
import Placeholder from './placeholder/container'
import WrapperMessage from './wrapper/container'
import {namedConnect, compose, lifecycle} from '../../../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  measure?: ?() => void,
  ordinal: Types.Ordinal,
  previous: ?Types.Ordinal,
|}

type Props = {
  message: Types.Message,
  previous: ?Types.Message,
  isEditing: boolean,
  measure: null | (() => void),
  you: string,
}

class MessageFactory extends React.PureComponent<Props> {
  render() {
    if (!this.props.message) {
      return null
    }

    const message = this.props.message

    const messageWrapperProps = {
      isEditing: this.props.isEditing,
      measure: this.props.measure,
      message,
      previous: this.props.previous,
    }

    switch (message.type) {
      case 'text':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={!message.exploded && !message.errorReason}>
            <TextMessage message={message} isEditing={this.props.isEditing} />
          </WrapperMessage>
        )
      case 'attachment':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={!message.exploded && !message.errorReason}>
            {({toggleShowingMenu}) => (
              <AttachmentMessage message={message} toggleMessageMenu={toggleShowingMenu} />
            )}
          </WrapperMessage>
        )
      case 'requestPayment':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={true}>
            <PaymentMessage message={message} />
          </WrapperMessage>
        )
      case 'sendPayment':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={true}>
            <PaymentMessage message={message} />
          </WrapperMessage>
        )
      case 'placeholder':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <Placeholder message={message} />
          </WrapperMessage>
        )
      case 'systemInviteAccepted':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemInviteAccepted message={message} />
          </WrapperMessage>
        )
      case 'systemSimpleToComplex':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemSimpleToComplex message={message} />
          </WrapperMessage>
        )
      case 'systemGitPush':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemGitPush message={message} />
          </WrapperMessage>
        )
      case 'systemAddedToTeam':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={true}>
            <SystemAddedToTeam message={message} />
          </WrapperMessage>
        )
      case 'systemJoined':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={message.author !== this.props.you}>
            <SystemJoined message={message} />
          </WrapperMessage>
        )
      case 'systemText':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemText message={message} />
          </WrapperMessage>
        )
      case 'systemLeft':
        return (
          <WrapperMessage {...messageWrapperProps} decorate={true}>
            <SystemLeft message={message} />
          </WrapperMessage>
        )
      case 'setDescription':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SetDescription message={message} />
          </WrapperMessage>
        )
      case 'setChannelname':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SetChannelname message={message} />
          </WrapperMessage>
        )
      // case 'error':
      // return <Error message={message} />
      case 'deleted':
        return null
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(message.type);
      */
        return null
    }
  }
}

const mapStateToProps = (state, {ordinal, previous, conversationIDKey}) => {
  const message: ?Types.Message = Constants.getMessage(state, conversationIDKey, ordinal)
  const editInfo = Constants.getEditInfo(state, conversationIDKey)
  const isEditing = !!(message && editInfo && editInfo.ordinal === message.ordinal)
  const previousMessage = previous ? Constants.getMessage(state, conversationIDKey, previous) : null
  return {
    isEditing,
    message,
    previous: previousMessage,
    you: state.config.username,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isEditing: stateProps.isEditing,
  measure: ownProps.measure,
  message: stateProps.message,
  previous: stateProps.previous,
  you: stateProps.username,
})

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'MessageFactory'),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (!this.props.message) {
        return
      }
      // If our message is the same id but anything else changed then we need to remeasure
      if (
        this.props.measure &&
        this.props.message !== prevProps.message &&
        (prevProps.message && this.props.message.ordinal === prevProps.message.ordinal)
      ) {
        this.props.measure()
      }
    },
  })
)(MessageFactory)
