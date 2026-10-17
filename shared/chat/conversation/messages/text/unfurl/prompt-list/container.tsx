import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import Prompt from './prompt'
import {promptResult} from './result'
import {
  useConversationThreadUnfurlResolvePrompt,
  useConversationThreadSelector,
} from '@/chat/conversation/thread-context'

const emptySet = new Set<string>()

function UnfurlPromptListContainer({messageID}: {messageID: T.Chat.MessageID}) {
  const promptDomains = useConversationThreadSelector(s => s.unfurlPrompt.get(messageID) ?? emptySet)
  const unfurlResolvePrompt = useConversationThreadUnfurlResolvePrompt()

  return (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
      {[...promptDomains].map(domain => (
        <Prompt
          key={domain}
          domain={domain}
          onAnswer={(accept, remember) =>
            unfurlResolvePrompt(messageID, domain, promptResult(domain, accept, remember))
          }
          onDismiss={() => unfurlResolvePrompt(messageID, domain, promptResult(domain, false, false))}
        />
      ))}
    </Kb.Box2>
  )
}

export default UnfurlPromptListContainer
