// @flow
import * as Constants from '../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as I from 'immutable'
import {namedConnect} from '../../../../../util/container'
import UnfurlPromptList from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal}

const mapStateToProps = (state, {conversationIDKey, ordinal}: OwnProps) => {
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  return {
    promptDomains: message && message.type === 'text' ? message.unfurlPrompts : I.Set(),
    messageID: message && message.type === 'text' ? message.id : Types.numberToMessageID(0),
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => {
  const simpleResp = (actionType: any, messageID: Types.MessageID) => {
    dispatch(
      Chat2Gen.createUnfurlResolvePrompt({
        conversationIDKey,
        messageID,
        result: {actionType},
      })
    )
  }
  return {
    onAlways: (messageID: Types.MessageID) =>
      simpleResp(RPCChatTypes.localUnfurlPromptAction.always, messageID),
    onNever: (messageID: Types.MessageID) =>
      simpleResp(RPCChatTypes.localUnfurlPromptAction.never, messageID),
    onNotnow: (messageID: Types.MessageID) =>
      simpleResp(RPCChatTypes.localUnfurlPromptAction.notnow, messageID),
    onAccept: (domain: string, messageID: Types.MessageID) => {
      const actionType: any = RPCChatTypes.localUnfurlPromptAction.accept
      const result: RPCChatTypes.UnfurlPromptResult = {
        actionType,
        accept: domain,
      }
      dispatch(Chat2Gen.createUnfurlResolvePrompt({conversationIDKey, messageID, result}))
    },
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const prompts = []
  const messageID: Types.MessageID = stateProps.messageID
  for (let pd of stateProps.promptDomains) {
    prompts.push({
      domain: pd,
      onAccept: () => dispatchProps.onAccept(pd, messageID),
      onAlways: () => dispatchProps.onAlways(messageID),
      onNever: () => dispatchProps.onNever(messageID),
      onNotnow: () => dispatchProps.onNotnow(messageID),
    })
  }
  return {prompts}
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UnfurlPromptList'
)(UnfurlPromptList)
