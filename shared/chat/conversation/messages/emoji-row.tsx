import * as React from 'react'
import * as InputState from '../input-area/input-state'
import {useOrdinal} from './ids-context'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {EmojiPickerDesktop} from '@/chat/emoji-picker/container'
import {useReactionRowTopReacjis} from '@/chat/user-reacjis'
import {showForwardMessagePicker} from '../fwd-msg'
import {
  useConversationThreadID,
  useConversationThreadMessage,
  useConversationThreadMessageActions,
} from '../thread-context'

type OwnProps = {
  className?: string
  hasUnfurls: boolean
  // desktop hover overlay only: after mounting, measure how far we stick out past the bottom of
  // the message list and shift ourselves up by that much, so the lowest on-screen row's emoji
  // row doesn't end up under the input box
  keepWithinList?: boolean
  messageType: T.Chat.MessageType
  onReact?: (emoji: string) => void
  onReply?: () => void
  onShowingEmojiPicker?: (arg0: boolean) => void
  style?: Kb.Styles.StylesCrossPlatform
}

function EmojiRowContainer(p: OwnProps) {
  const {
    className,
    hasUnfurls,
    keepWithinList,
    messageType,
    onReact: onReactProp,
    onReply: onReplyProp,
    onShowingEmojiPicker,
    style,
  } = p
  const ordinal = useOrdinal()
  const setReplyTo = InputState.useConversationInputDispatch(s => s.setReplyTo)
  const {toggleMessageReaction} = useConversationThreadMessageActions()
  const emojis = useReactionRowTopReacjis()
  const conversationIDKey = useConversationThreadID()
  const message = useConversationThreadMessage(ordinal)
  const hasMessageID = !!message && !!T.Chat.messageIDToNumber(message.id)
  const _onForward = () => {
    showForwardMessagePicker(conversationIDKey, message)
  }
  const onReact = (emoji: string) => {
    if (!hasMessageID) {
      return
    }
    if (onReactProp) {
      onReactProp(emoji)
      return
    }
    toggleMessageReaction(ordinal, emoji)
  }
  const _onReply = () => {
    setReplyTo(ordinal)
  }

  const onForward = hasMessageID && (hasUnfurls || messageType === 'attachment') ? _onForward : undefined
  const onReply =
    messageType === 'text' || messageType === 'attachment' ? (onReplyProp ?? _onReply) : undefined

  const [showingPicker, setShowingPicker] = React.useState(false)
  const popupAnchor = React.useRef<Kb.MeasureRef | null>(null)

  // We mount mid-hover and then STAY mounted while the row shows/hides us with CSS alone, so a
  // single mount-time measurement goes stale as soon as the list scrolls: measure now and again
  // on every pointer re-entry into the row. Typed structurally since the native tsconfig has no
  // DOM lib; on desktop Box2's MeasureRef is the backing div.
  const [raiseBy, setRaiseBy] = React.useState(0)
  const raiseByRef = React.useRef(0)
  React.useLayoutEffect(() => {
    if (isMobile || !keepWithinList) {
      return
    }
    type ElLike = {
      addEventListener: (t: string, cb: () => void) => void
      removeEventListener: (t: string, cb: () => void) => void
      getBoundingClientRect: () => {bottom: number; height: number}
    }
    const el = popupAnchor.current as null | (ElLike & {closest?: (sel: string) => ElLike | null})
    const row = el?.closest?.('.WrapperMessage-hoverBox')
    const list = el?.closest?.('.chat-message-list')
    if (!el || !row || !list) {
      return
    }
    const measure = () => {
      const rect = el.getBoundingClientRect()
      // zero height means we're display:none and the rect is meaningless
      if (rect.height === 0) {
        return
      }
      // add back the raise we're currently applying so overflow is computed from our natural spot
      const overflow = rect.bottom + raiseByRef.current - list.getBoundingClientRect().bottom
      const next = Math.max(0, overflow)
      raiseByRef.current = next
      setRaiseBy(next)
    }
    // the enter event that mounted us already fired, so measure directly too
    measure()
    row.addEventListener('mouseenter', measure)
    return () => {
      row.removeEventListener('mouseenter', measure)
    }
  }, [keepWithinList])

  const _setShowingPicker = (showingPicker: boolean) => {
    onShowingEmojiPicker?.(showingPicker)
    setShowingPicker(showingPicker)
  }
  const _showPicker = () => _setShowingPicker(true)
  const _hidePicker = () => _setShowingPicker(false)
  return (
    <Kb.Box2
      direction="horizontal"
      ref={popupAnchor}
      style={Kb.Styles.collapseStyles([
        styles.container,
        style,
        raiseBy > 0
          ? Kb.Styles.platformStyles({isElectron: {transform: `translateY(-${raiseBy}px)`}})
          : undefined,
      ])}
      className={className}
    >
      <Kb.Box2 direction="horizontal" gap="tiny">
        {emojis.map(e => (
          <HoverEmoji emoji={e} key={e.name} onClick={() => onReact(e.name)} />
        ))}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal">
        <Kb.Divider style={styles.divider} vertical={true} />
        <Kb.ClickableBox
          direction="vertical"
          className="hover_container"
          onClick={hasMessageID ? _showPicker : undefined}
          style={Kb.Styles.collapseStyles([styles.iconContainer, !hasMessageID && styles.disabled])}
          tooltip="React"
        >
          <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reacji" />
        </Kb.ClickableBox>
        {!!onReply && (
          <Kb.ClickableBox
            direction="vertical"
            className="hover_container"
            onClick={onReply}
            style={styles.iconContainer}
            tooltip="Reply"
          >
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reply" />
          </Kb.ClickableBox>
        )}
        {!!onForward && (
          <Kb.ClickableBox
            direction="vertical"
            className="hover_container"
            onClick={onForward}
            style={styles.iconContainer}
            tooltip="Forward"
          >
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-forward" />
          </Kb.ClickableBox>
        )}
      </Kb.Box2>
      {showingPicker && message && hasMessageID && (
        <Kb.Popup
          attachTo={popupAnchor}
          containerStyle={styles.pickerContainer}
          position="top right"
          onHidden={_hidePicker}
          propagateOutsideClicks={false}
        >
          <EmojiPickerDesktop
            conversationIDKey={conversationIDKey}
            onPickAddToMessageID={message.id}
            onDidPick={_hidePicker}
          />
        </Kb.Popup>
      )}
    </Kb.Box2>
  )
}

const HoverEmoji = (props: {emoji: T.RPCGen.UserReacji; onClick: () => void}) => {
  const [hovering, setHovering] = React.useState(false)
  const _setHovering = () => setHovering(true)
  const _setNotHovering = () => setHovering(false)
  return (
    <Kb.ClickableBox
      direction="horizontal"
      centerChildren={true}
      onClick={props.onClick}
      onMouseOver={_setHovering}
      onMouseLeave={_setNotHovering}
      style={styles.emojiBox}
    >
      <Kb.Emoji
        userReacji={props.emoji}
        noAnim={!hovering}
        showTooltip={false}
        size={hovering ? 22 : 18}
        style={styles.hoverEmoji}
        virtualText={true}
      />
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.xsmall)},
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
          height: Kb.Styles.globalMargins.medium,
        },
      }),
      disabled: {opacity: 0.3},
      divider: {
        ...Kb.Styles.marginV(Kb.Styles.globalMargins.tiny),
        marginLeft: Kb.Styles.globalMargins.xsmall,
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
      emojiBox: {
        ...Kb.Styles.size(Kb.Styles.globalMargins.small),
        marginRight: Kb.Styles.globalMargins.xxtiny,
      },
      hoverEmoji: {position: 'absolute'},
      icon: {
        position: 'relative',
        top: 1,
      },
      iconContainer: {padding: Kb.Styles.globalMargins.tiny},
      pickerContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          borderRadius: Kb.Styles.borderRadius,
          margin: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)

export default EmojiRowContainer
