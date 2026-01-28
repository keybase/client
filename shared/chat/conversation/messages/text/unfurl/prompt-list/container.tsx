import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import Prompt from './prompt'

const noMessageID = T.Chat.numberToMessageID(0)

const UnfurlPromptListContainer = React.memo(function UnfurlPromptListContainer() {
  const ordinal = useOrdinal()
  const {unfurlResolvePrompt, messageID, promptDomains} = Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      const messageID = message?.type === 'text' ? message.id : noMessageID
      const unfurlResolvePrompt = s.dispatch.unfurlResolvePrompt
      const promptDomains = s.unfurlPrompt.get(messageID)
      return {messageID, promptDomains, unfurlResolvePrompt}
    })
  )
  const _setPolicy = React.useCallback(
    (domain: string, result: T.RPCChat.UnfurlPromptResult) => {
      unfurlResolvePrompt(messageID, domain, result)
    },
    [messageID, unfurlResolvePrompt]
  )
  const prompts = [...(promptDomains ?? [])].map(domain => ({
    domain,
    onAccept: () =>
      _setPolicy(domain, {
        accept: domain,
        actionType: T.RPCChat.UnfurlPromptAction.accept,
      }),
    onAlways: () =>
      _setPolicy(domain, {
        actionType: T.RPCChat.UnfurlPromptAction.always,
      }),
    onNever: () =>
      _setPolicy(domain, {
        actionType: T.RPCChat.UnfurlPromptAction.never,
      }),
    onNotnow: () =>
      _setPolicy(domain, {
        actionType: T.RPCChat.UnfurlPromptAction.notnow,
      }),
    onOnetime: () =>
      _setPolicy(domain, {
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
