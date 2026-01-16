import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import {useOrdinal} from './ids-context'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {EmojiPickerDesktop} from '@/chat/emoji-picker/container'

type OwnProps = {
  className?: string
  onShowingEmojiPicker?: (arg0: boolean) => void
  style?: Kb.Styles.StylesCrossPlatform
}

const EmojiRowContainer = React.memo(function EmojiRowContainer(p: OwnProps) {
  const {className, onShowingEmojiPicker, style} = p
  const ordinal = useOrdinal()

  const {hasUnfurls, setReplyTo, toggleMessageReaction, type} = Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const type = m?.type
      const hasUnfurls = (m?.unfurls?.size ?? 0) > 0
      const {toggleMessageReaction, setReplyTo} = s.dispatch
      return {hasUnfurls, setReplyTo, toggleMessageReaction, type}
    })
  )

  const emojis = Chat.useChatState(C.useShallow(s => s.userReacjis.topReacjis.slice(0, 5)))
  const navigateAppend = Chat.useChatNavigateAppend()
  const _onForward = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, ordinal},
      selected: 'chatForwardMsgPick',
    }))
  }, [navigateAppend, ordinal])
  const onReact = React.useCallback(
    (emoji: string) => {
      toggleMessageReaction(ordinal, emoji)
    },
    [toggleMessageReaction, ordinal]
  )
  const _onReply = React.useCallback(() => {
    setReplyTo(ordinal)
  }, [setReplyTo, ordinal])

  const onForward = hasUnfurls || type === 'attachment' ? _onForward : undefined
  const onReply = type === 'text' || type === 'attachment' ? _onReply : undefined

  const [showingPicker, setShowingPicker] = React.useState(false)
  const popupAnchor = React.useRef<Kb.MeasureRef | null>(null)
  const _setShowingPicker = (showingPicker: boolean) => {
    onShowingEmojiPicker?.(showingPicker)
    setShowingPicker(showingPicker)
  }
  const _showPicker = () => _setShowingPicker(true)
  const _hidePicker = () => _setShowingPicker(false)
  return (
    <Kb.Box2Measure
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
        <Kb.Box
          className="hover_container"
          onClick={_showPicker}
          style={styles.iconContainer}
          tooltip="React"
        >
          <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reacji" />
        </Kb.Box>
        {!!onReply && (
          <Kb.Box className="hover_container" onClick={onReply} style={styles.iconContainer} tooltip="Reply">
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reply" />
          </Kb.Box>
        )}
        {!!onForward && (
          <Kb.Box
            className="hover_container"
            onClick={onForward}
            style={styles.iconContainer}
            tooltip="Forward"
          >
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-forward" />
          </Kb.Box>
        )}
      </Kb.Box2>
      {showingPicker && (
        <Kb.FloatingBox
          attachTo={popupAnchor}
          containerStyle={styles.pickerContainer}
          position="top right"
          onHidden={_hidePicker}
          propagateOutsideClicks={false}
        >
          <EmojiPickerDesktop onPickAddToMessageOrdinal={ordinal} onDidPick={_hidePicker} />
        </Kb.FloatingBox>
      )}
    </Kb.Box2Measure>
  )
})

const HoverEmoji = (props: {emoji: T.RPCGen.UserReacji; onClick: () => void}) => {
  const [hovering, setHovering] = React.useState(false)
  const _setHovering = React.useCallback(() => setHovering(true), [])
  const _setNotHovering = React.useCallback(() => setHovering(false), [])
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
