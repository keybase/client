// @flow
import * as Constants2 from '../../../constants/chat2'
import * as React from 'react'
import * as RouteTree from '../../../route-tree'
import * as Types2 from '../../../constants/types/chat2'
import Error from './error/container'
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
  message: Types2.Message,
  previous: ?Types2.Message,
  isEditing: boolean,
  isSelected: boolean,
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
      case 'error':
        return <Error message={this.props.message} />
      case 'deleted':
        return null
      default:
        // eslint-disable-next-line no-unused-expressions
        ;(this.props.message.type: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
        return null
    }
  }
}

const mapStateToProps = (state: TypedState, {ordinal, previous}) => {
  const conversationIDKey = Constants2.getSelectedConversation(state)
  const messageMap = Constants2.getMessageMap(state, conversationIDKey)
  const message = messageMap.get(ordinal)
  return {
    isEditing:
      message &&
      conversationIDKey &&
      Constants2.getEditingOrdinal(state, conversationIDKey) === message.ordinal,
    isSelected: messageActionMessage(state, conversationIDKey) === message,
    message,
    previous: previous ? messageMap.get(previous) : null,
  }
}

const getRouteState = (state: TypedState) => state.routeTree.routeState

const messageActionMessage = createSelector(
  [getRouteState, Constants2.getSelectedConversation],
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
})

export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  lifecycle({
    componentDidUpdate(prevProps) {
      // If our message is the same id but anything else changed then we need to remeasure
      if (
        this.props._measure &&
        this.props.message !== prevProps.message &&
        this.props.message.ordinal === prevProps.message.ordinal
      ) {
        this.props._measure()
      }
    },
  })
)(MessageFactory)
