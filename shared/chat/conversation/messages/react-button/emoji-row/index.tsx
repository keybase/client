import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {Picker} from '../picker'
import {backgroundImageFn} from '../../../../../common-adapters/emoji'

type Props = {
  className?: string
  emojis: Array<string>
  onReact: (arg0: string) => void
  onReply?: () => void
  onShowingEmojiPicker?: (arg0: boolean) => void
  style?: Styles.StylesCrossPlatform
}

class HoverEmoji extends React.Component<{name: string; onClick: () => void}, {hovering: boolean}> {
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
        <Kb.Emoji disableSelecting={true} size={this.state.hovering ? 22 : 18} emojiName={this.props.name} />
      </Kb.ClickableBox>
    )
  }
}

class EmojiRow extends React.Component<Props, {showingPicker: boolean}> {
  state = {showingPicker: false}
  _attachmentRef = React.createRef<Kb.Box2>()
  _setShowingPicker = showingPicker => {
    this.props.onShowingEmojiPicker && this.props.onShowingEmojiPicker(showingPicker)
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  }
  _showPicker = () => this._setShowingPicker(true)
  _hidePicker = () => this._setShowingPicker(false)
  _onAddReaction = ({colons}: {colons: string}) => {
    this.props.onReact(colons)
    this._setShowingPicker(false)
  }
  _getAttachmentRef = () => this._attachmentRef.current
  render() {
    return (
      <Kb.Box2
        direction="horizontal"
        gap="tiny"
        ref={this._attachmentRef}
        style={Styles.collapseStyles([styles.container, this.props.style])}
        className={this.props.className}
      >
        <Kb.Box2 direction="horizontal" gap="tiny">
          {this.props.emojis.map(e => (
            <HoverEmoji name={e} key={e} onClick={() => this.props.onReact(e)} />
          ))}
        </Kb.Box2>
        {!!this.props.onReply && (
          <Kb.Box2 direction="horizontal" gap="tiny">
            <Kb.Divider style={styles.divider} vertical={true} />
            <Kb.WithTooltip text="React">
              <Kb.Icon
                hoverColor={Styles.globalColors.blue}
                onClick={this._showPicker}
                style={Kb.iconCastPlatformStyles(styles.icon)}
                type="iconfont-reacji"
              />
            </Kb.WithTooltip>
            <Kb.WithTooltip text="Reply">
              <Kb.Icon
                hoverColor={Styles.globalColors.blue}
                onClick={this.props.onReply}
                style={Kb.iconCastPlatformStyles(styles.icon)}
                type="iconfont-reply"
              />
            </Kb.WithTooltip>
          </Kb.Box2>
        )}
        {this.state.showingPicker && (
          <Kb.FloatingBox
            attachTo={this._getAttachmentRef}
            containerStyle={styles.pickerContainer}
            position="top right"
            onHidden={this._hidePicker}
          >
            <Picker backgroundImageFn={backgroundImageFn} onClick={this._onAddReaction} />
          </Kb.FloatingBox>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
  },
  emojiBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: Styles.globalMargins.small,
    justifyContent: 'center',
    width: Styles.globalMargins.small,
  },
  icon: {
    position: 'relative',
    top: 1,
  },
  pickerContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: Styles.borderRadius,
      margin: Styles.globalMargins.tiny,
    },
  }),
})

export default EmojiRow
