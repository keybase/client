import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as React from 'react'
import * as Styles from '../../../../styles'
import {ConvoIDContext} from '../ids-context'
import type * as Types from '../../../../constants/types/chat2'
import type CoinFlipType from './coinflip'
import type UnfurlListType from './unfurl/unfurl-list'
import type UnfurlPromptListType from './unfurl/prompt-list/container'
import shallowEqual from 'shallowequal'

type Props = {
  showCenteredHighlight: boolean
  hasBeenEdited: boolean
  hasUnfurlPrompts: boolean
  hasUnfurlList: boolean
  hasCoinFlip: boolean
  toggleShowingPopup: () => void
}

export const useBottom = (
  ordinal: Types.Ordinal,
  showCenteredHighlight: boolean,
  toggleShowingPopup: () => void
) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {hasBeenEdited, hasUnfurlPrompts, hasCoinFlip, hasUnfurlList} = Container.useSelector(state => {
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const hasCoinFlip = message?.type === 'text' && !!message.flipGameID
    const hasUnfurlList = (message?.unfurls?.size ?? 0) > 0

    const id = message?.id
    const hasUnfurlPrompts = id
      ? (state.chat2.unfurlPromptMap.get(conversationIDKey)?.get(id)?.size ?? 0) > 0
      : false
    const hasBeenEdited = message?.hasBeenEdited ?? false
    return {hasBeenEdited, hasCoinFlip, hasUnfurlList, hasUnfurlPrompts}
  }, shallowEqual)

  return React.useMemo(
    () => (
      <WrapperTextBottom
        hasBeenEdited={hasBeenEdited}
        hasCoinFlip={hasCoinFlip}
        hasUnfurlList={hasUnfurlList}
        hasUnfurlPrompts={hasUnfurlPrompts}
        showCenteredHighlight={showCenteredHighlight}
        toggleShowingPopup={toggleShowingPopup}
      />
    ),
    [hasBeenEdited, hasCoinFlip, hasUnfurlList, hasUnfurlPrompts, showCenteredHighlight, toggleShowingPopup]
  )
}

const WrapperTextBottom = function WrapperTextBottom(p: Props) {
  const {showCenteredHighlight, hasBeenEdited, hasUnfurlPrompts, hasUnfurlList, hasCoinFlip} = p
  const edited = hasBeenEdited ? (
    <Kb.Text
      key="isEdited"
      type="BodyTiny"
      fixOverdraw={!showCenteredHighlight}
      style={showCenteredHighlight ? styles.editedHighlighted : styles.edited}
    >
      EDITED
    </Kb.Text>
  ) : null

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
      {edited}
      {unfurlPrompts}
      {unfurlList}
      {coinflip}
    </>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      edited: {color: Styles.globalColors.black_20},
      editedHighlighted: {color: Styles.globalColors.black_20OrBlack},
    } as const)
)
