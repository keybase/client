import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import EmojiRow from '../emoji-row/container'
import ReactButton from '../react-button/container'
import ReactionTooltip from '../reaction-tooltip'
import type * as T from '@/constants/types'
import {OrdinalContext} from '../ids-context'
import {Keyboard} from 'react-native'

// Get array of emoji names in the order of their earliest reaction
const getOrderedReactions = (reactions?: T.Chat.Reactions) => {
  if (!reactions) {
    return []
  }

  const scoreMap = new Map(
    [...reactions.entries()].map(([key, value]) => {
      return [
        key,
        [...value.users].reduce(
          (minTimestamp, reaction) => Math.min(minTimestamp, reaction.timestamp),
          Infinity
        ),
      ]
    })
  )
  return [...reactions.keys()].sort((a, b) => scoreMap.get(a)! - scoreMap.get(b)!)
}

const ReactionsRowContainer = React.memo(function ReactionsRowContainer() {
  const ordinal = React.useContext(OrdinalContext)
  const reactions = C.useChatContext(
    C.useDeep(s => {
      const message = s.messageMap.get(ordinal)
      const reactions = message?.reactions
      return reactions
    })
  )

  const emojis = React.useMemo(() => {
    return getOrderedReactions(reactions)
  }, [reactions])

  return emojis.length === 0 ? null : (
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.container}>
      {emojis.map((emoji, idx) => (
        <RowItem key={String(idx)} emoji={emoji} />
      ))}
      {Kb.Styles.isMobile ? (
        <ReactButton showBorder={true} style={styles.button} />
      ) : (
        <EmojiRow className={Kb.Styles.classNames([btnClassName, newBtnClassName])} style={styles.emojiRow} />
      )}
    </Kb.Box2>
  )
})

export type Props = {
  activeEmoji: string
  emojis: Array<string>
  ordinal: T.Chat.Ordinal
  setActiveEmoji: (s: string) => void
  setHideMobileTooltip: () => void
  setShowMobileTooltip: () => void
  showMobileTooltip: boolean
}

const btnClassName = 'WrapperMessage-emojiButton'
const newBtnClassName = 'WrapperMessage-newEmojiButton'

type IProps = {
  emoji: string
}
const RowItem = React.memo(function RowItem(p: IProps) {
  const ordinal = React.useContext(OrdinalContext)
  const {emoji} = p

  const popupAnchor = React.useRef<Kb.MeasureRef>(null)
  const [showingPopup, setShowingPopup] = React.useState(false)

  const showPopup = React.useCallback(() => {
    Kb.Styles.isMobile && Keyboard.dismiss()
    setShowingPopup(true)
  }, [])
  const hidePopup = React.useCallback(() => {
    setShowingPopup(false)
  }, [])

  const popup = showingPopup ? (
    <ReactionTooltip
      attachmentRef={popupAnchor}
      emoji={emoji}
      onHidden={hidePopup}
      ordinal={ordinal}
      visible={true}
    />
  ) : null

  return (
    <Kb.Box2Measure direction="vertical" onMouseOver={showPopup} onMouseLeave={hidePopup} ref={popupAnchor}>
      <ReactButton
        className={btnClassName}
        emoji={emoji}
        onLongPress={Kb.Styles.isMobile ? showPopup : undefined}
        style={styles.button}
      />
      {popup}
    </Kb.Box2Measure>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {marginBottom: Kb.Styles.globalMargins.tiny},
      container: {
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        paddingRight: 66,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      emojiRow: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        marginBottom: Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.xtiny,
      },
      visibilityHidden: Kb.Styles.platformStyles({isElectron: {visibility: 'hidden'}}),
    }) as const
)

export default ReactionsRowContainer
