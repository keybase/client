import * as React from 'react'
import {ConvoIDContext, OrdinalContext} from '../../../ids-context'
import * as Constants from '../../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Types from '../../../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as Container from '../../../../../../util/container'
import UnfurlPromptList from '.'

const noPrompts = new Set<string>()
const noMessageID = Types.numberToMessageID(0)

const UnfurlPromptListContainer = React.memo(function UnfurlPromptListContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const messageID = message && message.type === 'text' ? message.id : noMessageID
  let promptDomains: Set<string> | undefined

  const pm = Container.useSelector(state => state.chat2.unfurlPromptMap.get(conversationIDKey))
  if (pm) {
    promptDomains = pm.get(messageID)
  }
  promptDomains = promptDomains || noPrompts

  const dispatch = Container.useDispatch()
  const _setPolicy = (
    messageID: Types.MessageID,
    domain: string,
    result: RPCChatTypes.UnfurlPromptResult
  ) => {
    dispatch(Chat2Gen.createUnfurlResolvePrompt({conversationIDKey, domain, messageID, result}))
  }
  const props = {
    prompts: [...promptDomains].map(domain => ({
      domain,
      onAccept: () =>
        _setPolicy(messageID, domain, {
          accept: domain,
          actionType: RPCChatTypes.UnfurlPromptAction.accept,
        }),
      onAlways: () =>
        _setPolicy(messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.always,
        }),
      onNever: () =>
        _setPolicy(messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.never,
        }),
      onNotnow: () =>
        _setPolicy(messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.notnow,
        }),
      onOnetime: () =>
        _setPolicy(messageID, domain, {
          actionType: RPCChatTypes.UnfurlPromptAction.onetime,
          onetime: domain,
        }),
    })),
  }

  return <UnfurlPromptList {...props} />
})
export default UnfurlPromptListContainer
