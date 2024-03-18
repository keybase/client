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

class HoverEmoji extends React.Component<
  {emoji: T.RPCGen.UserReacji; onClick: () => void},
  {hovering: boolean}
> {
  state = {hovering: false}
  _setHovering = () => this.setState(s => (s.hovering ? null : {hovering: true}))
  _setNotHovering = () => this.setState(s => (s.hovering ? {hovering: false} : null))
  render() {
    return (
      <Kb.ClickableBox
        onClick={this.props.onClick}
        onMouseOver={this._setHovering}
        onMouseLeave={this._setNotHovering}
        underlayColor={Kb.Styles.globalColors.transparent}
        hoverColor={Kb.Styles.globalColors.transparent}
        style={styles.emojiBox}
      >
        {renderEmoji({
          emoji: RPCUserReacjiToRenderableEmoji(this.props.emoji, !this.state.hovering),
          showTooltip: false,
          size: this.state.hovering ? 22 : 18,
          style: styles.hoverEmoji,
          virtualText: true,
        })}
      </Kb.ClickableBox>
    )
  }
}

class EmojiRow extends React.Component<Props, {showingPicker: boolean}> {
  state = {showingPicker: false}
  popupAnchor = React.createRef<Kb.MeasureRef>()
  _setShowingPicker = (showingPicker: boolean) => {
    this.props.onShowingEmojiPicker?.(showingPicker)
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  }
  _showPicker = () => this._setShowingPicker(true)
  _hidePicker = () => this._setShowingPicker(false)
  render() {
    return (
      <Kb.Box2Measure
        direction="horizontal"
        ref={this.popupAnchor}
        style={Kb.Styles.collapseStyles([styles.container, this.props.style])}
        className={this.props.className}
      >
        <Kb.Box2 direction="horizontal" gap="tiny">
          {this.props.emojis.map(e => (
            <HoverEmoji emoji={e} key={e.name} onClick={() => this.props.onReact(e.name)} />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal">
          <Kb.Divider style={styles.divider} vertical={true} />
          <Kb.Box
            className="hover_container"
            onClick={this._showPicker}
            style={styles.iconContainer}
            tooltip="React"
          >
            <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reacji" />
          </Kb.Box>
          {!!this.props.onReply && (
            <Kb.Box
              className="hover_container"
              onClick={this.props.onReply}
              style={styles.iconContainer}
              tooltip="Reply"
            >
              <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reply" />
            </Kb.Box>
          )}
          {!!this.props.onForward && (
            <Kb.Box
              className="hover_container"
              onClick={this.props.onForward}
              style={styles.iconContainer}
              tooltip="Forward"
            >
              <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-forward" />
            </Kb.Box>
          )}
        </Kb.Box2>
        {this.state.showingPicker && (
          <Kb.FloatingBox
            attachTo={this.popupAnchor}
            containerStyle={styles.pickerContainer}
            position="top right"
            onHidden={this._hidePicker}
            propagateOutsideClicks={false}
          >
            <EmojiPickerDesktop onPickAddToMessageOrdinal={this.props.ordinal} onDidPick={this._hidePicker} />
          </Kb.FloatingBox>
        )}
      </Kb.Box2Measure>
    )
  }
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
