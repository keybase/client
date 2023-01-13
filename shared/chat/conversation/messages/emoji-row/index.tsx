import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'
import type * as RPCTypes from '../../../../constants/types/rpc-gen'
import {EmojiPickerDesktop} from '../../../emoji-picker/container'
import {renderEmoji, RPCUserReacjiToRenderableEmoji} from '../../../../util/emoji'

type Props = {
  className?: string
  conversationIDKey: Types.ConversationIDKey
  emojis: Array<RPCTypes.UserReacji>
  onForward?: () => void
  onReact: (arg0: string) => void
  onReply?: () => void
  onShowingEmojiPicker?: (arg0: boolean) => void
  ordinal: Types.Ordinal
  style?: Styles.StylesCrossPlatform
  tooltipPosition?: Styles.Position
}

class HoverEmoji extends React.Component<
  {emoji: RPCTypes.UserReacji; onClick: () => void},
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
        underlayColor={Styles.globalColors.transparent}
        hoverColor={Styles.globalColors.transparent}
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
  _attachmentRef = React.createRef<Kb.Box2>()
  _setShowingPicker = (showingPicker: boolean) => {
    this.props.onShowingEmojiPicker?.(showingPicker)
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  }
  _showPicker = () => this._setShowingPicker(true)
  _hidePicker = () => this._setShowingPicker(false)
  _getAttachmentRef = () => this._attachmentRef.current
  render() {
    return (
      <Kb.Box2
        direction="horizontal"
        ref={this._attachmentRef}
        style={Styles.collapseStyles([styles.container, this.props.style])}
        className={this.props.className}
      >
        <Kb.Box2 direction="horizontal" gap="tiny">
          {this.props.emojis.map(e => (
            <HoverEmoji emoji={e} key={e.name} onClick={() => this.props.onReact(e.name)} />
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal">
          <Kb.Divider style={styles.divider} vertical={true} />
          <Kb.WithTooltip tooltip="React" position={this.props.tooltipPosition}>
            <Kb.Box className="hover_container" onClick={this._showPicker} style={styles.iconContainer}>
              <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reacji" />
            </Kb.Box>
          </Kb.WithTooltip>
          {!!this.props.onReply && (
            <Kb.WithTooltip tooltip="Reply" position={this.props.tooltipPosition}>
              <Kb.Box className="hover_container" onClick={this.props.onReply} style={styles.iconContainer}>
                <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-reply" />
              </Kb.Box>
            </Kb.WithTooltip>
          )}
          {!!this.props.onForward && (
            <Kb.WithTooltip tooltip="Forward" position={this.props.tooltipPosition}>
              <Kb.Box className="hover_container" onClick={this.props.onForward} style={styles.iconContainer}>
                <Kb.Icon className="hover_contained_color_blue" style={styles.icon} type="iconfont-forward" />
              </Kb.Box>
            </Kb.WithTooltip>
          )}
        </Kb.Box2>
        {this.state.showingPicker && (
          <Kb.FloatingBox
            attachTo={this._getAttachmentRef}
            containerStyle={styles.pickerContainer}
            position="top right"
            onHidden={this._hidePicker}
            propagateOutsideClicks={false}
          >
            <EmojiPickerDesktop
              conversationIDKey={this.props.conversationIDKey}
              onPickAddToMessageOrdinal={this.props.ordinal}
              onDidPick={this._hidePicker}
            />
          </Kb.FloatingBox>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.xsmall),
        },
        isElectron: {
          backgroundColor: Styles.globalColors.blueLighter3,
          height: Styles.globalMargins.medium,
        },
      }),
      divider: {
        marginBottom: Styles.globalMargins.tiny,
        marginLeft: Styles.globalMargins.xsmall,
        marginRight: Styles.globalMargins.xtiny,
        marginTop: Styles.globalMargins.tiny,
      },
      emojiBox: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: Styles.globalMargins.small,
        justifyContent: 'center',
        marginRight: Styles.globalMargins.xxtiny,
        width: Styles.globalMargins.small,
      },
      hoverEmoji: {position: 'absolute'},
      icon: {
        position: 'relative',
        top: 1,
      },
      iconContainer: Styles.platformStyles({
        common: {
          padding: Styles.globalMargins.tiny,
        },
        isElectron: {
          ...Styles.desktopStyles.clickable,
        },
      }),
      pickerContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.boxShadow,
          borderRadius: Styles.borderRadius,
          margin: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default EmojiRow
