import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import Prompt from '@/chat/conversation/messages/text/unfurl/prompt-list/prompt'
import {
  useConversationThreadUnfurlResolvePrompt,
  useConversationThreadSelector,
} from '@/chat/conversation/thread-context'

const emptySet = new Set<string>()

function UnfurlPromptListContainer({messageID}: {messageID: T.Chat.MessageID}) {
  const promptDomains = useConversationThreadSelector(s => s.unfurlPrompt.get(messageID) ?? emptySet)
  const unfurlResolvePrompt = useConversationThreadUnfurlResolvePrompt()
  const _setPolicy = (domain: string, result: T.RPCChat.UnfurlPromptResult) => {
    unfurlResolvePrompt(messageID, domain, result)
  }
  const prompts = [...promptDomains].map(domain => ({
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
