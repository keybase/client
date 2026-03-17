import type CoinFlipType from './coinflip'
import type UnfurlListType from './unfurl/unfurl-list'
import type UnfurlPromptListType from './unfurl/prompt-list/container'

type Props = {
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
}

export const useBottom = (data: Props) => {
  return <WrapperTextBottom hasCoinFlip={data.hasCoinFlip} hasUnfurlList={data.hasUnfurlList} hasUnfurlPrompts={data.hasUnfurlPrompts} />
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
