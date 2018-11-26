// @flow
import * as React from 'react'
import {WrapperMessage} from '../'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {namedConnect} from '../../../../../util/container'

export type OwnProps = {|
  children?: React.Node,
  isEditing: boolean,
  measure: null | (() => void),
  message: Types.Message,
  previous: ?Types.Message,
|}

const shouldDecorateMessage = (message: Types.Message, you: string) => {
  if (
    (message.type === 'text' || message.type === 'attachment') &&
    (message.exploded || message.errorReason)
  ) {
    return false
  }
  if (message.type === 'systemJoined') {
    // special case. "You joined #<channel>" messages render with a blue user notice so don't decorate those
    return message.author !== you
  }
  return Constants.decoratedMessageTypes.includes(message.type)
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const messageIDWithOrangeLine = state.chat2.orangeLineMap.get(ownProps.message.conversationIDKey)
  const unfurlPrompts =
    ownProps.message.type === 'text'
      ? state.chat2.unfurlPromptMap.getIn([ownProps.message.conversationIDKey, ownProps.message.id])
      : null
  return {
    _you: state.config.username || '',
    conversationIDKey: ownProps.message.conversationIDKey,
    orangeLineAbove: messageIDWithOrangeLine === ownProps.message.id,
    ordinal: ownProps.message.ordinal,
    previous: ownProps.previous,
    shouldShowPopup: Constants.shouldShowPopup(state, ownProps.message),
    hasUnfurlPrompts: !!unfurlPrompts && !unfurlPrompts.isEmpty(),
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const {ordinal, previous} = stateProps
  const {message} = ownProps

  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    Constants.authorIsCollapsible(message) &&
    Constants.authorIsCollapsible(previous)
  const isShowingUsername = !previous || !sequentialUserMessages

  let type = 'children'
  if (Constants.showAuthorMessageTypes.includes(ownProps.message.type)) {
    type = 'wrapper-author'
  }

  const decorate = shouldDecorateMessage(message, stateProps._you)

  return {
    children: ownProps.children,
    conversationIDKey: stateProps.conversationIDKey,
    decorate,
    exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
    isEditing: ownProps.isEditing,
    isRevoked: (message.type === 'text' || message.type === 'attachment') && !!message.deviceRevokedAt,
    isShowingUsername,
    measure: ownProps.measure,
    message: message,
    orangeLineAbove: stateProps.orangeLineAbove,
    ordinal,
    previous: ownProps.previous,
    shouldShowPopup: stateProps.shouldShowPopup,
    type,
    hasUnfurlPrompts: stateProps.hasUnfurlPrompts,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'WrapperMessage')(
  WrapperMessage
)
