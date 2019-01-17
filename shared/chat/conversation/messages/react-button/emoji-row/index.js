// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import getEmojis from './data'

type Props = {
  attachTo: () => ?React.Component<any>,
  onHidden: () => void,
  onOpenEmojiPicker: () => void,
  onReact: string => void,
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

const EmojiRow = (props: Props) =>
  props.visible ? (
    <Kb.FloatingBox
      attachTo={props.attachTo}
      onHidden={props.onHidden}
      position="bottom right"
      containerStyle={props.style}
    >
      <HoverBox direction="horizontal" style={styles.innerContainer}>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.emojisRow}>
          {getEmojis()
            .slice(0, 5)
            .map(e => (
              <HoverEmoji name={e} key={e} onClick={() => props.onReact(e)} />
            ))}
          <HoverEmoji name="" isReacjiIcon={true} onClick={props.onOpenEmojiPicker} key="reacji-icon" />
        </Kb.Box2>
      </HoverBox>
    </Kb.FloatingBox>
  ) : null

const styles = Styles.styleSheetCreate({
  emojiBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    // position: 'relative',
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
  reacjiIcon: {position: 'relative', top: 1},
})

export default EmojiRow
