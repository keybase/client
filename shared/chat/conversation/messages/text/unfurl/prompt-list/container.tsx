import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import Prompt from './prompt'

function UnfurlPromptListContainer({messageID}: {messageID: T.Chat.MessageID}) {
  const {unfurlResolvePrompt, promptDomains} = ConvoState.useChatContext(
    C.useShallow(s => {
      const unfurlResolvePrompt = s.dispatch.unfurlResolvePrompt
      const promptDomains = s.unfurlPrompt.get(messageID)
      return {promptDomains, unfurlResolvePrompt}
    })
  )
  const _setPolicy = (domain: string, result: T.RPCChat.UnfurlPromptResult) => {
    unfurlResolvePrompt(messageID, domain, result)
  }
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
}

export default UnfurlPromptListContainer
