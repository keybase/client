import * as C from '../../../../../../constants'
import * as React from 'react'
import {OrdinalContext} from '../../../ids-context'
import * as T from '../../../../../../constants/types'
import UnfurlPromptList from '.'

const noMessageID = T.Chat.numberToMessageID(0)

const UnfurlPromptListContainer = React.memo(function UnfurlPromptListContainer() {
  const ordinal = React.useContext(OrdinalContext)
  const message = C.useChatContext(s => s.messageMap.get(ordinal))
  const messageID = message && message.type === 'text' ? message.id : noMessageID
  const promptDomains = C.useChatContext(s => s.unfurlPrompt).get(messageID)
  const unfurlResolvePrompt = C.useChatContext(s => s.dispatch.unfurlResolvePrompt)
  const _setPolicy = (messageID: T.Chat.MessageID, domain: string, result: T.RPCChat.UnfurlPromptResult) => {
    unfurlResolvePrompt(messageID, domain, result)
  }
  const props = {
    prompts: [...(promptDomains ?? [])].map(domain => ({
      domain,
      onAccept: () =>
        _setPolicy(messageID, domain, {
          accept: domain,
          actionType: T.RPCChat.UnfurlPromptAction.accept,
        }),
      onAlways: () =>
        _setPolicy(messageID, domain, {
          actionType: T.RPCChat.UnfurlPromptAction.always,
        }),
      onNever: () =>
        _setPolicy(messageID, domain, {
          actionType: T.RPCChat.UnfurlPromptAction.never,
        }),
      onNotnow: () =>
        _setPolicy(messageID, domain, {
          actionType: T.RPCChat.UnfurlPromptAction.notnow,
        }),
      onOnetime: () =>
        _setPolicy(messageID, domain, {
          actionType: T.RPCChat.UnfurlPromptAction.onetime,
          onetime: domain,
        }),
    })),
  }

  return <UnfurlPromptList {...props} />
})
export default UnfurlPromptListContainer
