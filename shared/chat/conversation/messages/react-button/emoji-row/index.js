// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {backgroundImageFn} from '../../../../../common-adapters/emoji'
import {Picker} from '../picker'
import getEmojis from './data'

type Props = {
  attachTo: () => ?React.Component<any>,
  onReact: string => void,
  onShowPicker: boolean => void,
  style?: Styles.StylesCrossPlatform,
  visible: boolean,
}

const HoverBox = Styles.styled(Kb.Box2)({
  '&:hover': {
    boxShadow: 'none',
  },
  boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.2)',
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
  _pickerAttachment = React.createRef<Kb.Box2>()
  _onShowPicker = showingPicker => {
    this.props.onShowPicker(showingPicker)
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  }
  _showPicker = () => this._onShowPicker(true)
  _hidePicker = () => this._onShowPicker(false)
  _onReact = emoji => {
    this._onShowPicker(false)
    this.props.onReact(emoji)
  }
  render() {
    return (
      <>
        {this.props.visible ? (
          <Kb.FloatingBox
            attachTo={this.props.attachTo}
            position="bottom right"
            propagateOutsideClicks={true}
            containerStyle={this.props.style}
          >
            <HoverBox direction="horizontal" style={styles.innerContainer}>
              <Kb.Box2
                direction="horizontal"
                gap="tiny"
                style={styles.emojisRow}
                ref={this._pickerAttachment}
              >
                {getEmojis()
                  .slice(0, 5)
                  .map(e => (
                    <HoverEmoji name={e} key={e} onClick={() => this.props.onReact(`:${e}:`)} />
                  ))}
                <HoverEmoji
                  name=""
                  isReacjiIcon={true}
                  onClick={() => this._onShowPicker(true)}
                  key="reacji-icon"
                />
              </Kb.Box2>
            </HoverBox>
          </Kb.FloatingBox>
        ) : null}
        {this.state.showingPicker && (
          <Kb.FloatingBox
            attachTo={() => this._pickerAttachment.current}
            position="top right"
            containerStyle={styles.picker}
            onHidden={() => this._onShowPicker(false)}
          >
            <Picker onClick={({colons}) => this._onReact(colons)} backgroundImageFn={backgroundImageFn} />
          </Kb.FloatingBox>
        )}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
  innerContainer: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      overflowX: 'hidden',
      overflowY: 'auto',
      position: 'relative',
    },
  }),
  picker: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      boxShadow: `0 0 8px 0 ${Styles.globalColors.black_20}`,
      margin: Styles.globalMargins.small,
    },
  }),
  reacjiIcon: {position: 'relative', top: 1},
})

export default EmojiRow
