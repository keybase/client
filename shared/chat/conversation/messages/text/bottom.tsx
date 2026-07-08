import CoinFlip from './coinflip'
import UnfurlList from './unfurl/unfurl-list'
import UnfurlPromptList from './unfurl/prompt-list/container'
import type * as T from '@/constants/types'

type Props = {
  author: string
  conversationIDKey: T.Chat.ConversationIDKey
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
  messageID: T.Chat.MessageID
  unfurls?: T.Chat.UnfurlMap
}

export const useBottom = (data: Props) => {
  return (
    <WrapperTextBottom
      author={data.author}
      conversationIDKey={data.conversationIDKey}
      hasCoinFlip={data.hasCoinFlip}
      hasUnfurlList={data.hasUnfurlList}
      hasUnfurlPrompts={data.hasUnfurlPrompts}
      messageID={data.messageID}
      unfurls={data.unfurls}
    />
  )
}

const WrapperTextBottom = function WrapperTextBottom(p: Props) {
  const {author, conversationIDKey, hasUnfurlPrompts, hasUnfurlList, hasCoinFlip, messageID, unfurls} = p

  const unfurlPrompts = (() => {
    if (hasUnfurlPrompts) {
      return <UnfurlPromptList messageID={messageID} />
    }
    return null
  })()

  const unfurlList = (() => {
    if (hasUnfurlList) {
      return <UnfurlList author={author} conversationIDKey={conversationIDKey} key="UnfurlList" unfurls={unfurls} />
    }
    return null
  })()

  const coinflip = (() => {
    if (hasCoinFlip) {
      return <CoinFlip key="CoinFlip" />
    }
    return null
  })()

  return (
    <>
      {unfurlPrompts}
      {unfurlList}
      {coinflip}
    </>
  )
}
