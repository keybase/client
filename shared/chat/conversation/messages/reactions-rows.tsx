import * as Message from '@/constants/chat/message'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import EmojiRow from './emoji-row'
import ReactButton, {NewReactionButton} from './react-button'
import ReactionTooltip from './reaction-tooltip'
import type * as T from '@/constants/types'
import {useOrdinal} from './ids-context'
import {Keyboard} from 'react-native'

const emptyEmojis: ReadonlyArray<string> = []

type OwnProps = {
  hasUnfurls: boolean
  messageType: T.Chat.MessageType
  onReact: (emoji: string) => void
  onReply: () => void
  reactions?: T.Chat.Reactions
}

function ReactionsRowContainer(p: OwnProps) {
  const {hasUnfurls, messageType, onReact, onReply, reactions} = p
  const emojis = React.useMemo(
    () => (reactions?.size ? Message.getReactionOrder(reactions) : emptyEmojis),
    [reactions]
  )

  return emojis.length === 0 ? null : (
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.container}>
      {emojis.map((emoji, idx) => {
        const reaction = reactions?.get(emoji)
        return reaction ? (
          <RowItem key={emoji || String(idx)} emoji={emoji} onReact={onReact} reaction={reaction} />
        ) : null
      })}
      {Kb.Styles.isMobile ? (
        <NewReactionButton style={styles.button} />
      ) : (
        <EmojiRow
          className={Kb.Styles.classNames([btnClassName, newBtnClassName])}
          hasUnfurls={hasUnfurls}
          messageType={messageType}
          onReact={onReact}
          onReply={onReply}
          style={styles.emojiRow}
        />
      )}
    </Kb.Box2>
  )
}

const btnClassName = 'WrapperMessage-emojiButton'
const newBtnClassName = 'WrapperMessage-newEmojiButton'

type IProps = {
  emoji: string
  onReact: (emoji: string) => void
  reaction: T.Chat.ReactionDesc
}
function RowItem(p: IProps) {
  const ordinal = useOrdinal()
  const {emoji, onReact, reaction} = p

  const popupAnchor = React.useRef<Kb.MeasureRef | null>(null)
  const [showingPopup, setShowingPopup] = React.useState(false)

  const showPopup = () => {
    if (Kb.Styles.isMobile) {
      Keyboard.dismiss()
    }
    setShowingPopup(true)
  }
  const hidePopup = () => {
    setShowingPopup(false)
  }

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
    <Kb.Box2 direction="vertical" onMouseOver={showPopup} onMouseLeave={hidePopup} ref={popupAnchor}>
      <ReactButton
        className={btnClassName}
        emoji={emoji}
        reaction={reaction}
        style={styles.button}
        toggleReaction={onReact}
        {...(Kb.Styles.isMobile ? {onLongPress: showPopup} : {})}
      />
      {popup}
    </Kb.Box2>
  )
}

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
    }) as const
)

export default ReactionsRowContainer
