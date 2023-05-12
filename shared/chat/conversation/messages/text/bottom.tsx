import * as Container from '../../../../util/container'
import * as React from 'react'
import {ConvoIDContext} from '../ids-context'
import type * as Types from '../../../../constants/types/chat2'
import type CoinFlipType from './coinflip'
import type UnfurlListType from './unfurl/unfurl-list'
import type UnfurlPromptListType from './unfurl/prompt-list/container'
import shallowEqual from 'shallowequal'

type Props = {
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
  toggleShowingPopup: () => void
}

export const useBottom = (ordinal: Types.Ordinal, toggleShowingPopup: () => void) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {hasUnfurlPrompts, hasCoinFlip, hasUnfurlList} = Container.useSelector(state => {
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const hasCoinFlip = message?.type === 'text' && !!message.flipGameID
    const hasUnfurlList = (message?.unfurls?.size ?? 0) > 0

    const id = message?.id
    const hasUnfurlPrompts = id
      ? (state.chat2.unfurlPromptMap.get(conversationIDKey)?.get(id)?.size ?? 0) > 0
      : false
    return {hasCoinFlip, hasUnfurlList, hasUnfurlPrompts}
  }, shallowEqual)

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
