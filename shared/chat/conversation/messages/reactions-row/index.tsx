import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import EmojiRow from '../emoji-row/container'
import ReactButton from '../react-button/container'
import ReactionTooltip from '../reaction-tooltip/container'
import type * as Types from '../../../../constants/types/chat2'
import {ConvoIDContext, OrdinalContext} from '../ids-context'

// Get array of emoji names in the order of their earliest reaction
const getOrderedReactions = (reactions?: Types.Reactions) => {
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

const ReactionsRowContainer = React.memo(function ReactonsRowContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const reactions = Container.useSelector(state => {
    const message = Constants.getMessage(state, conversationIDKey, ordinal)
    const reactions = message?.reactions
    return reactions
  })

  const emojis = React.useMemo(() => {
    return getOrderedReactions(reactions)
  }, [reactions])

  return emojis.length === 0 ? null : (
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.container}>
      {emojis.map((emoji, idx) => (
        <RowItem key={String(idx)} emoji={emoji} />
      ))}
      {Styles.isMobile ? (
        <ReactButton showBorder={true} style={styles.button} />
      ) : (
        <EmojiRow className={Styles.classNames([btnClassName, newBtnClassName])} style={styles.emojiRow} />
      )}
    </Kb.Box2>
  )
})

export type Props = {
  activeEmoji: string
  conversationIDKey: Types.ConversationIDKey
  emojis: Array<string>
  ordinal: Types.Ordinal
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
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {emoji} = p

  const popupAnchor = React.useRef<Kb.Box2 | null>(null)
  const [showingPopup, setShowingPopup] = React.useState(false)

  const showPopup = React.useCallback(() => {
    setShowingPopup(true)
  }, [])
  const hidePopup = React.useCallback(() => {
    setShowingPopup(false)
  }, [])

  const popup = showingPopup ? (
    <ReactionTooltip
      attachmentRef={() => popupAnchor.current}
      conversationIDKey={conversationIDKey}
      emoji={emoji}
      onHidden={hidePopup}
      ordinal={ordinal}
      visible={true}
    />
  ) : null

  return (
    <Kb.Box2 direction="vertical" onMouseOver={showPopup} onMouseLeave={hidePopup} ref={popupAnchor}>
      <ReactButton
        className={btnClassName}
        emoji={emoji}
        onLongPress={Styles.isMobile ? showPopup : undefined}
        style={styles.button}
      />
      {popup}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {marginBottom: Styles.globalMargins.tiny},
      container: {
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        paddingRight: 66,
        paddingTop: Styles.globalMargins.tiny,
      },
      emojiRow: {
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        marginBottom: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.xtiny,
      },
      visibilityHidden: Styles.platformStyles({isElectron: {visibility: 'hidden'}}),
    } as const)
)

export default ReactionsRowContainer
