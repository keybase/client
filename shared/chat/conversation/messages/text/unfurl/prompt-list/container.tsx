import * as C from '@/constants'
import * as React from 'react'
import {OrdinalContext} from '@/chat/conversation/messages/ids-context'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import Prompt from './prompt'

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
  const prompts = [...(promptDomains ?? [])].map(domain => ({
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
  }))

  return (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
      {prompts.map(prompt => (
        <Prompt {...prompt} key={prompt.domain} />
      ))}
    </Kb.Box2>
  )
})

export default UnfurlPromptListContainer
