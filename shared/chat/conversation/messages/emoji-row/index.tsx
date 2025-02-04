import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {EmojiPickerDesktop} from '@/chat/emoji-picker/container'
import {renderEmoji, RPCUserReacjiToRenderableEmoji} from '@/util/emoji'

type Props = {
  className?: string
  emojis: Array<T.RPCGen.UserReacji>
  onForward?: () => void
  onReact: (arg0: string) => void
  onReply?: () => void
  onShowingEmojiPicker?: (arg0: boolean) => void
  ordinal: T.Chat.Ordinal
  style?: Kb.Styles.StylesCrossPlatform
  tooltipPosition?: Kb.Styles.Position
}

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
      {renderEmoji({
        emoji: RPCUserReacjiToRenderableEmoji(props.emoji, !hovering),
        showTooltip: false,
        size: hovering ? 22 : 18,
        style: styles.hoverEmoji,
        virtualText: true,
      })}
    </Kb.ClickableBox>
  )
}

const EmojiRow = (props: Props) => {
  const [showingPicker, setShowingPicker] = React.useState(false)
  const popupAnchor = React.useRef<Kb.MeasureRef>(null)
  const _setShowingPicker = (showingPicker: boolean) => {
    props.onShowingEmojiPicker?.(showingPicker)
    setShowingPicker(showingPicker)
  }
  const _showPicker = () => _setShowingPicker(true)
  const _hidePicker = () => _setShowingPicker(false)
  return (
    <Kb.Box2Measure
      direction="horizontal"
      ref={popupAnchor}
      style={Kb.Styles.collapseStyles([styles.container, props.style])}
      className={props.className}
    >
      <Kb.Box2 direction="horizontal" gap="tiny">
        {props.emojis.map(e => (
          <HoverEmoji emoji={e} key={e.name} onClick={() => props.onReact(e.name)} />
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
        {!!props.onReply && (
          <Kb.Box
            className="hover_container"
            onClick={props.onReply}
            style={styles.iconContainer}
            tooltip="Reply"
          >
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reply" />
          </Kb.Box>
        )}
        {!!props.onForward && (
          <Kb.Box
            className="hover_container"
            onClick={props.onForward}
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
          <EmojiPickerDesktop onPickAddToMessageOrdinal={props.ordinal} onDidPick={_hidePicker} />
        </Kb.FloatingBox>
      )}
    </Kb.Box2Measure>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xtiny, Kb.Styles.globalMargins.xsmall),
        },
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
        common: {
          padding: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
        },
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

export default EmojiRow
