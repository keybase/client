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
import TextMessage from './text/container'
import Attachment from './attachment/container'
import SetDescription from './set-description/container'
import SetChannelname from './set-channelname/container'
import Placeholder from './placeholder/container'
import Wrapper from './wrapper/container'
import {connect, compose, lifecycle, type TypedState} from '../../../util/container'

type Props = {
  message: Types.Message,
  previous: ?Types.Message,
  isEditing: boolean,
}

class MessageFactory extends React.PureComponent<Props> {
  render() {
    if (!this.props.message) {
      return null
    }
    switch (this.props.message.type) {
      case 'text':
        return (
          <Wrapper
            innerClass={TextMessage}
            isEditing={this.props.isEditing}
            message={this.props.message}
            previous={this.props.previous}
          />
        )
      case 'attachment':
        return (
          <Wrapper
            innerClass={Attachment}
            isEditing={this.props.isEditing}
            message={this.props.message}
            previous={this.props.previous}
          />
        )
      case 'placeholder':
        return <Placeholder message={this.props.message} />
      case 'systemInviteAccepted':
        return <SystemInviteAccepted message={this.props.message} />
      case 'systemSimpleToComplex':
        return <SystemSimpleToComplex message={this.props.message} />
      case 'systemGitPush':
        return <SystemGitPush message={this.props.message} />
      case 'systemAddedToTeam':
        return <SystemAddedToTeam message={this.props.message} />
      case 'systemJoined':
        return <SystemJoined message={this.props.message} />
      case 'systemText':
        return <SystemText message={this.props.message} />
      case 'systemLeft':
        return <SystemLeft message={this.props.message} />
      case 'setDescription':
        return <SetDescription message={this.props.message} />
      case 'setChannelname':
        return <SetChannelname message={this.props.message} />
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

const mapStateToProps = (state: TypedState, {ordinal, previous, conversationIDKey}) => {
  const messageMap = Constants.getMessageMap(state, conversationIDKey)
  const message = messageMap.get(ordinal)
  const editingOrdinal = Constants.getEditingOrdinal(state, conversationIDKey)
  return {
    isEditing: message && conversationIDKey && editingOrdinal === message.ordinal,
    message,
    previous: previous ? messageMap.get(previous) : null,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _measure: ownProps.measure,
  isEditing: stateProps.isEditing,
  message: stateProps.message,
  previous: stateProps.previous,
})

export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (!this.props.message) {
        return
      }
      // If our message is the same id but anything else changed then we need to remeasure
      if (
        this.props._measure &&
        this.props.message !== prevProps.message &&
        (prevProps.message && this.props.message.ordinal === prevProps.message.ordinal)
      ) {
        this.props._measure()
      }
    },
  })
)(MessageFactory)
