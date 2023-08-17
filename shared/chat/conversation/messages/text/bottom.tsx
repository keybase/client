import * as C from '../../../../constants'
import * as React from 'react'
import shallowEqual from 'shallowequal'
import type * as T from '../../../../constants/types'
import type CoinFlipType from './coinflip'
import type UnfurlListType from './unfurl/unfurl-list'
import type UnfurlPromptListType from './unfurl/prompt-list/container'

type Props = {
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
  toggleShowingPopup: () => void
}

export const useBottom = (ordinal: T.Chat.Ordinal, toggleShowingPopup: () => void) => {
  const {id, hasCoinFlip, hasUnfurlList} = C.useChatContext(s => {
    const message = s.messageMap.get(ordinal)
    const hasCoinFlip = message?.type === 'text' && !!message.flipGameID
    const hasUnfurlList = (message?.unfurls?.size ?? 0) > 0
    const id = message?.id
    return {hasCoinFlip, hasUnfurlList, id}
  }, shallowEqual)

  const hasUnfurlPrompts = C.useChatContext(s => !!id && !!s.unfurlPrompt.get(id)?.size)

  return React.useMemo(
    () => (
      <WrapperTextBottom
        hasCoinFlip={hasCoinFlip}
        hasUnfurlList={hasUnfurlList}
        hasUnfurlPrompts={hasUnfurlPrompts}
        toggleShowingPopup={toggleShowingPopup}
      />
    ),
    [hasCoinFlip, hasUnfurlList, hasUnfurlPrompts, toggleShowingPopup]
  )
}

const WrapperTextBottom = function WrapperTextBottom(p: Props) {
  const {hasUnfurlPrompts, hasUnfurlList, hasCoinFlip} = p

  const unfurlPrompts = (() => {
    if (hasUnfurlPrompts) {
      const UnfurlPromptList = require('./unfurl/prompt-list/container')
        .default as typeof UnfurlPromptListType
      return <UnfurlPromptList />
    }
    return null
  })()

  const unfurlList = (() => {
    const UnfurlList = require('./unfurl/unfurl-list').default as typeof UnfurlListType
    if (hasUnfurlList) {
      return <UnfurlList key="UnfurlList" />
    }
    return null
  })()

  const coinflip = (() => {
    if (hasCoinFlip) {
      const CoinFlip = require('./coinflip').default as typeof CoinFlipType
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
