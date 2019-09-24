import * as Constants from '../../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Types from '../../../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../../../util/container'
import UnfurlPromptList from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
}

const noPrompts = new Set<string>()
const noMessageID = Types.numberToMessageID(0)

export default namedConnect(
  (state, {conversationIDKey, ordinal}: OwnProps) => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    const messageID = message && message.type === 'text' ? message.id : noMessageID
    let promptDomains: Set<string> | undefined

    const pm = state.chat2.unfurlPromptMap.get(conversationIDKey)
    if (pm) {
      promptDomains = pm.get(messageID)
    }
    return {
      messageID,
      promptDomains: promptDomains || noPrompts,
    }
  },
  (dispatch, {conversationIDKey}: OwnProps) => ({
    _setPolicy: (messageID: Types.MessageID, domain: string, result: RPCChatTypes.UnfurlPromptResult) => {
      dispatch(Chat2Gen.createUnfurlResolvePrompt({conversationIDKey, domain, messageID, result}))
    },
  }),
  (stateProps, dispatchProps, _) => ({
    prompts: [...stateProps.promptDomains].map(domain => ({
      domain,
      onAccept: () =>
        dispatchProps._setPolicy(stateProps.messageID, domain, {
          accept: domain,
          actionType: RPCChatTypes.UnfurlPromptAction.accept,
        }),
      onAlways: () =>
        dispatchProps._setPolicy(stateProps.messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.always,
        }),
      onNever: () =>
        dispatchProps._setPolicy(stateProps.messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.never,
        }),
      onNotnow: () =>
        dispatchProps._setPolicy(stateProps.messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.notnow,
        }),
      onOnetime: () =>
        dispatchProps._setPolicy(stateProps.messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.onetime,
          onetime: domain,
        }),
    })),
  }),

  'UnfurlPromptList'
)(UnfurlPromptList)
