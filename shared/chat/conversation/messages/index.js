// @flow
import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as RouteTree from '../../../route-tree'
import * as Types from '../../../constants/types/chat2'
import OldProfileReset from './system-old-profile-reset-notice/container'
import ResetUser from './reset-user/container'
import SystemAddedToTeam from './system-added-to-team/container'
import SystemGitPush from './system-git-push/container'
import SystemInviteAccepted from './system-invite-accepted/container'
import SystemJoined from './system-joined/container'
import SystemLeft from './system-left/container'
import SystemSimpleToComplex from './system-simple-to-complex/container'
import SystemText from './system-text/container'
import TextMessage from './text/container'
import Attachment from './attachment/container'
import Wrapper from './wrapper/container'
import {chatTab} from '../../../constants/tabs'
import {connect, compose, lifecycle, type TypedState, createSelector} from '../../../util/container'

type Props = {
  message: Types.Message,
  previous: ?Types.Message,
  isEditing: boolean,
  isSelected: boolean,
  showResetParticipants: ?Types.ConversationIDKey,
  showSuperseded: ?Types.ConversationIDKey,
}

class MessageFactory extends React.PureComponent<Props> {
  render() {
    if (this.props.showResetParticipants) {
      return <ResetUser conversationIDKey={this.props.showResetParticipants} />
    }
    if (this.props.showSuperseded) {
      return <OldProfileReset conversationIDKey={this.props.showSuperseded} />
    }
    if (!this.props.message) {
      return null
    }

    switch (this.props.message.type) {
      case 'text':
        return (
          <Wrapper
            innerClass={TextMessage}
            isEditing={this.props.isEditing}
            isSelected={this.props.isSelected}
            message={this.props.message}
            previous={this.props.previous}
          />
        )
      case 'attachment':
        return (
          <Wrapper
            innerClass={Attachment}
            isEditing={this.props.isEditing}
            isSelected={this.props.isSelected}
            message={this.props.message}
            previous={this.props.previous}
          />
        )
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
      // case 'error':
      // return <Error message={this.props.message} />
      case 'deleted':
        return null
      default:
        // eslint-disable-next-line no-unused-expressions
        ;(this.props.message.type: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
        return null
    }
  }
}

const mapStateToProps = (state: TypedState, {ordinal, previous, conversationIDKey}) => {
  const messageMap = Constants.getMessageMap(state, conversationIDKey)
  const message = messageMap.get(ordinal)
  let showResetParticipants = null
  let showSuperseded = null
  if (!message) {
    const meta = Constants.getMeta(state, conversationIDKey)
    showResetParticipants = meta && !meta.resetParticipants.isEmpty() ? conversationIDKey : null
    showSuperseded = meta && meta.supersededByCausedBy ? conversationIDKey : null
  }
  return {
    isEditing:
      message &&
      conversationIDKey &&
      Constants.getEditingOrdinal(state, conversationIDKey) === message.ordinal,
    isSelected: messageActionMessage(state, conversationIDKey) === message,
    message,
    previous: previous ? messageMap.get(previous) : null,
    showResetParticipants,
    showSuperseded,
  }
}

const getRouteState = (state: TypedState) => state.routeTree.routeState

const messageActionMessage = createSelector(
  [getRouteState, (_, conversationIDKey) => conversationIDKey],
  (routeState, conversationIDKey) =>
    RouteTree.getPathProps(routeState, [chatTab, conversationIDKey, 'messageAction']).getIn([
      2,
      'props',
      'message',
    ])
)

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _measure: ownProps.measure,
  isEditing: stateProps.isEditing,
  isSelected: stateProps.isSelected,
  message: stateProps.message,
  previous: stateProps.previous,
  showResetParticipants: stateProps.showResetParticipants,
  showSuperseded: stateProps.showSuperseded,
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
