import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import {useOrdinal} from './ids-context'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {EmojiPickerDesktop} from '@/chat/emoji-picker/container'
import {useReactionRowTopReacjis} from '@/chat/user-reacjis'

type OwnProps = {
  className?: string
  hasUnfurls: boolean
  messageType: T.Chat.MessageType
  onReact?: (emoji: string) => void
  onReply?: () => void
  onShowingEmojiPicker?: (arg0: boolean) => void
  style?: Kb.Styles.StylesCrossPlatform
}

function EmojiRowContainer(p: OwnProps) {
  const {className, hasUnfurls, messageType, onReact: onReactProp, onReply: onReplyProp, onShowingEmojiPicker, style} = p
  const ordinal = useOrdinal()
  const setReplyTo = ConvoState.useChatUIContext(s => s.dispatch.setReplyTo)
  const toggleMessageReaction = ConvoState.useChatContext(s => s.dispatch.toggleMessageReaction)
  const emojis = useReactionRowTopReacjis()
  const navigateAppend = ConvoState.useChatNavigateAppend()
  const _onForward = () => {
    navigateAppend(conversationIDKey => ({
      name: 'chatForwardMsgPick',
      params: {conversationIDKey, ordinal},
    }))
  }
  const onReact = (emoji: string) => {
    if (onReactProp) {
      onReactProp(emoji)
      return
    }
    toggleMessageReaction(ordinal, emoji)
  }
  const _onReply = () => {
    setReplyTo(ordinal)
  }

  const onForward = hasUnfurls || messageType === 'attachment' ? _onForward : undefined
  const onReply =
    messageType === 'text' || messageType === 'attachment' ? (onReplyProp ?? _onReply) : undefined

  const [showingPicker, setShowingPicker] = React.useState(false)
  const popupAnchor = React.useRef<Kb.MeasureRef | null>(null)
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
      style={Kb.Styles.collapseStyles([styles.container, style])}
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
          className="hover_container"
          onClick={_showPicker}
          style={styles.iconContainer}
          tooltip="React"
        >
          <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reacji" />
        </Kb.ClickableBox>
        {!!onReply && (
          <Kb.ClickableBox className="hover_container" onClick={onReply} style={styles.iconContainer} tooltip="Reply">
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reply" />
          </Kb.ClickableBox>
        )}
        {!!onForward && (
          <Kb.ClickableBox
            className="hover_container"
            onClick={onForward}
            style={styles.iconContainer}
            tooltip="Forward"
          >
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-forward" />
          </Kb.ClickableBox>
        )}
      </Kb.Box2>
      {showingPicker && (
        <Kb.Popup
          attachTo={popupAnchor}
          containerStyle={styles.pickerContainer}
          position="top right"
          onHidden={_hidePicker}
          propagateOutsideClicks={false}
        >
          <EmojiPickerDesktop onPickAddToMessageOrdinal={ordinal} onDidPick={_hidePicker} />
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
      onClick={props.onClick}
      onMouseOver={_setHovering}
      onMouseLeave={_setNotHovering}
      underlayColor={Kb.Styles.globalColors.transparent}
      hoverColor={Kb.Styles.globalColors.transparent}
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
      divider: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginLeft: Kb.Styles.globalMargins.xsmall,
        marginRight: Kb.Styles.globalMargins.xtiny,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      emojiBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: Kb.Styles.globalMargins.small,
        justifyContent: 'center',
        marginRight: Kb.Styles.globalMargins.xxtiny,
        width: Kb.Styles.globalMargins.small,
      },
      hoverEmoji: {position: 'absolute'},
      icon: {
        position: 'relative',
        top: 1,
      },
      iconContainer: Kb.Styles.platformStyles({
        common: {padding: Kb.Styles.globalMargins.tiny},
        isElectron: {...Kb.Styles.desktopStyles.clickable},
      }),
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
