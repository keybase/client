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
  const simpleResp = (actionType: any, messageID: Types.MessageID, domain: string) => {
    dispatch(
      Chat2Gen.createUnfurlResolvePrompt({
        conversationIDKey,
        messageID,
        domain,
        result: {actionType},
      })
    )
  }
  return {
    onAlways: (messageID: Types.MessageID, domain: string) =>
      simpleResp(RPCChatTypes.localUnfurlPromptAction.always, messageID, domain),
    onNever: (messageID: Types.MessageID, domain: string) =>
      simpleResp(RPCChatTypes.localUnfurlPromptAction.never, messageID, domain),
    onNotnow: (messageID: Types.MessageID, domain: string) =>
      simpleResp(RPCChatTypes.localUnfurlPromptAction.notnow, messageID, domain),
    onAccept: (messageID: Types.MessageID, domain: string) => {
      const actionType: any = RPCChatTypes.localUnfurlPromptAction.accept
      const result: RPCChatTypes.UnfurlPromptResult = {
        actionType,
        accept: domain,
      }
      dispatch(Chat2Gen.createUnfurlResolvePrompt({conversationIDKey, messageID, domain, result}))
    },
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const prompts = []
  const messageID: Types.MessageID = stateProps.messageID
  for (let pd of stateProps.promptDomains) {
    prompts.push({
      domain: pd,
      onAccept: () => dispatchProps.onAccept(messageID, pd),
      onAlways: () => dispatchProps.onAlways(messageID, pd),
      onNever: () => dispatchProps.onNever(messageID, pd),
      onNotnow: () => dispatchProps.onNotnow(messageID, pd),
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
