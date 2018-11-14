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
import Placeholder from './placeholder/container'
import WrapperMessage from './wrapper/wrapper-message/container'
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
}

class MessageFactory extends React.PureComponent<Props> {
  render() {
    if (!this.props.message) {
      return null
    }

    const messageWrapperProps = {
      isEditing: this.props.isEditing,
      measure: this.props.measure,
      message: this.props.message,
      previous: this.props.previous,
    }

    switch (this.props.message.type) {
      case 'text':
        return <WrapperMessage {...messageWrapperProps} />
      case 'attachment':
        return <WrapperMessage {...messageWrapperProps} />
      case 'requestPayment':
        return <WrapperMessage {...messageWrapperProps} />
      case 'sendPayment':
        return <WrapperMessage {...messageWrapperProps} />
      case 'placeholder':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <Placeholder message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemInviteAccepted':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemInviteAccepted message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemSimpleToComplex':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemSimpleToComplex message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemGitPush':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemGitPush message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemAddedToTeam':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemAddedToTeam message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemJoined':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemJoined message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemText':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemText message={this.props.message} />
          </WrapperMessage>
        )
      case 'systemLeft':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SystemLeft message={this.props.message} />
          </WrapperMessage>
        )
      case 'setDescription':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SetDescription message={this.props.message} />
          </WrapperMessage>
        )
      case 'setChannelname':
        return (
          <WrapperMessage {...messageWrapperProps}>
            <SetChannelname message={this.props.message} />
          </WrapperMessage>
        )
      // case 'error':
      // return <Error message={this.props.message} />
      case 'deleted':
        return null
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(this.props.message.type);
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
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isEditing: stateProps.isEditing,
  measure: ownProps.measure,
  message: stateProps.message,
  previous: stateProps.previous,
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
