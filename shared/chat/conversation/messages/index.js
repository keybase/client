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
import WrapperTimestamp from './wrapper/wrapper-timestamp/container'
import {setDisplayName, connect, compose, lifecycle, type TypedState} from '../../../util/container'

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
        return <WrapperTimestamp {...messageWrapperProps} />
      case 'attachment':
        return <WrapperTimestamp {...messageWrapperProps} />
      case 'placeholder':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <Placeholder message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemInviteAccepted':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemInviteAccepted message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemSimpleToComplex':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemSimpleToComplex message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemGitPush':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemGitPush message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemAddedToTeam':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemAddedToTeam message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemJoined':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemJoined message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemText':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemText message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'systemLeft':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SystemLeft message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'setDescription':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SetDescription message={this.props.message} />
          </WrapperTimestamp>
        )
      case 'setChannelname':
        return (
          <WrapperTimestamp {...messageWrapperProps}>
            <SetChannelname message={this.props.message} />
          </WrapperTimestamp>
        )
      // case 'error':
      // return <Error message={this.props.message} />
      case 'requestPayment':
        return null // TODO
      case 'sendPayment':
        return null // TODO
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

const mapStateToProps = (state: TypedState, {ordinal, previous, conversationIDKey}) => {
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
  connect(mapStateToProps, () => ({}), mergeProps),
  setDisplayName('MessageFactory'),
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
