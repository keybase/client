import type CoinFlipType from './coinflip'
import type UnfurlListType from './unfurl/unfurl-list'
import type UnfurlPromptListType from './unfurl/prompt-list/container'
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
      const {default: UnfurlPromptList} = require('./unfurl/prompt-list/container') as {
        default: typeof UnfurlPromptListType
      }
      return <UnfurlPromptList messageID={messageID} />
    }
    return null
  })()

  const unfurlList = (() => {
    const {default: UnfurlList} = require('./unfurl/unfurl-list') as {default: typeof UnfurlListType}
    if (hasUnfurlList) {
      return <UnfurlList author={author} conversationIDKey={conversationIDKey} key="UnfurlList" unfurls={unfurls} />
    }
    return null
  })()

  const coinflip = (() => {
    if (hasCoinFlip) {
      const {default: CoinFlip} = require('./coinflip') as {default: typeof CoinFlipType}
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
