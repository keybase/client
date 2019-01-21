// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {Picker} from '../picker'
import {backgroundImageFn} from '../../../../../common-adapters/emoji'

type Props = {
  className?: string,
  emojis: Array<string>, // e.g. ':tada:'
  onReact: string => void,
  onShowingEmojiPicker?: boolean => void,
  style?: Styles.StylesCrossPlatform,
}

const HoverBox = Styles.styled(Kb.Box2)({
  '&:hover': {
    boxShadow: 'none',
  },
  boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.2)',
  ...Styles.transition('box-shadow'),
})

class HoverEmoji extends React.Component<
  {name: string, onClick: () => void, isReacjiIcon?: boolean},
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
        {this.props.isReacjiIcon ? (
          <Kb.Icon
            color={Styles.globalColors.black_50}
            fontSize={this.state.hovering ? 22 : 16}
            style={Kb.iconCastPlatformStyles(styles.reacjiIcon)}
            type="iconfont-reacji"
          />
        ) : (
          <Kb.Emoji size={this.state.hovering ? 22 : 16} emojiName={this.props.name} />
        )}
      </Kb.ClickableBox>
    )
  }
}

class EmojiRow extends React.Component<Props, {showingPicker: boolean}> {
  state = {showingPicker: false}
  _attachmentRef = React.createRef<HoverBox>()
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
      <HoverBox
        direction="horizontal"
        ref={this._attachmentRef}
        style={Styles.collapseStyles([styles.container, this.props.style])}
        className={this.props.className}
      >
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.emojisRow}>
          {this.props.emojis.map(e => (
            <HoverEmoji name={e} key={e} onClick={() => this.props.onReact(e)} />
          ))}
          <HoverEmoji name="" isReacjiIcon={true} onClick={this._showPicker} key="reacji-icon" />
        </Kb.Box2>
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
      </HoverBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
    },
  }),
  emojiBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  emojisRow: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.xtiny,
  },
  pickerContainer: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      boxShadow: `0 0 8px 0 ${Styles.globalColors.black_20}`,
      margin: Styles.globalMargins.tiny,
    },
  }),
  reacjiIcon: {position: 'relative', top: 1},
})

export default EmojiRow
