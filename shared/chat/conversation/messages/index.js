// Figured out a message and type re-measures cells
// @flow
import * as React from 'react'
import * as Constants2 from '../../../constants/chat2'
// import * as Constants from '../../../constants/chat'
import * as Types2 from '../../../constants/types/chat2'
// import * as Types from '../../../constants/types/chat'
// import Attachment from './attachment/container'
// import ErrorMessage from './error/container'
// import ResetUser from './resetUser/container'
// import JoinedLeft from './joinedleft/container'
// import System from './system/container'
// import ProfileResetNotice from '../notices/profile-reset-notice/container'
// import * as React from 'react'
import * as RouteTree from '../../../route-tree'
import TextMessage from './text/container'
// import Timestamp from './timestamp/container'
import Wrapper from './wrapper/container'
import {chatTab} from '../../../constants/tabs'
import {Box} from '../../../common-adapters'
import {connect, compose, lifecycle, type TypedState, createSelector} from '../../../util/container'
// import {connect, type TypedState} from '../../../util/container'

// const factory = (message: Types2.Message, previous: ?Types2.Message, measure: () => void) => {
// // TEMP
// const onAction = () => {}
// const onShowEditor = () => {}

// switch (message.type) {
// case 'text':
// return (
// <Wrapper
// innerClass={TextMessage}
// isSelected={false}
// measure={measure}
// message={message}
// onAction={onAction}
// onShowEditor={onShowEditor}
// previous={previous}
// />
// )
// default:
// return <Box data-message-key={message.ordinal} />
// }
// }

// const factory = (
// messageKey: Types2.Ordinal,
// prevMessageKey: ?Types2.Ordinal,
// onAction: () => [> message: Types.ServerMessage,
// localMessageState: Types.LocalMessageState,
// event: SyntheticEvent<> */
// void,
// onShowEditor: () => [> message: Types.ServerMessage, event: SyntheticEvent<> <] void,
// isSelected: boolean,
// measure: () => void
// ) => {
// const kind = Constants.messageKeyKind(messageKey)
// switch (kind) {
// case 'joinedleft':
// return <JoinedLeft messageKey={messageKey} />
// case 'system':
// return <System messageKey={messageKey} />
// case 'resetUser':
// return <ResetUser messageKey={messageKey} />
// case 'header':
// return <Header messageKey={messageKey} />
// case 'outboxIDAttachment': // fallthrough
// case 'messageIDAttachment':
// return (
// <Wrapper
// innerClass={Attachment}
// isSelected={isSelected}
// measure={measure}
// messageKey={messageKey}
// onAction={onAction}
// onShowEditor={onShowEditor}
// prevMessageKey={prevMessageKey}
// />
// )
// case 'error': // fallthrough
// case 'errorInvisible': // fallthrough
// case 'messageIDError':
// return <ErrorMessage messageKey={messageKey} />
// case 'outboxIDText': // fallthrough
// case 'messageIDText':
// return (
// <Wrapper
// innerClass={TextMessage}
// isSelected={isSelected}
// measure={measure}
// messageKey={messageKey}
// onAction={onAction}
// onShowEditor={onShowEditor}
// prevMessageKey={prevMessageKey}
// />
// )
// case 'supersedes':
// return <ProfileResetNotice />
// case 'timestamp':
// return <Timestamp messageKey={messageKey} />
// case 'messageIDUnhandled':
// return null
// }

// return <Box data-message-key={messageKey} />
// }

// export default factory

type Props = {
  // measure: () => void,
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
    }
    return <Box data-message-key={this.props.message.ordinal} />
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

export default compose(
  connect(mapStateToProps, () => ({})),
  lifecycle({
    componentDidUpdate(prevProps) {
      this.props.measure && this.props.message !== prevProps.message && this.props.measure()
    },
  })
)(MessageFactory)
