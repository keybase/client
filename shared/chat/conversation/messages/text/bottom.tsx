import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import type * as T from '@/constants/types'
import type CoinFlipType from './coinflip'
import type UnfurlListType from './unfurl/unfurl-list'
import type UnfurlPromptListType from './unfurl/prompt-list/container'

type Props = {
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
}

export const useBottom = (ordinal: T.Chat.Ordinal) => {
  const {hasCoinFlip, hasUnfurlList, hasUnfurlPrompts} = Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      const hasCoinFlip = message?.type === 'text' && !!message.flipGameID
      const hasUnfurlList = (message?.unfurls?.size ?? 0) > 0
      const id = message?.id
      const hasUnfurlPrompts = !!id && !!s.unfurlPrompt.get(id)?.size
      return {hasCoinFlip, hasUnfurlList, hasUnfurlPrompts}
    })
  )

  return React.useMemo(
    () => (
      <WrapperTextBottom
        hasCoinFlip={hasCoinFlip}
        hasUnfurlList={hasUnfurlList}
        hasUnfurlPrompts={hasUnfurlPrompts}
      />
    ),
    [hasCoinFlip, hasUnfurlList, hasUnfurlPrompts]
  )
}

const WrapperTextBottom = function WrapperTextBottom(p: Props) {
  const {hasUnfurlPrompts, hasUnfurlList, hasCoinFlip} = p

  const unfurlPrompts = (() => {
    if (hasUnfurlPrompts) {
      const {default: UnfurlPromptList} = require('./unfurl/prompt-list/container') as {
        default: typeof UnfurlPromptListType
      }
      return <UnfurlPromptList />
    }
    return null
  })()

  const unfurlList = (() => {
    const {default: UnfurlList} = require('./unfurl/unfurl-list') as {default: typeof UnfurlListType}
    if (hasUnfurlList) {
      return <UnfurlList key="UnfurlList" />
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
