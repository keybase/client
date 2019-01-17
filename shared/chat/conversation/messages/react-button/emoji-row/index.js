// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Props = {
  attachTo: () => ?React.Component<any>,
  emojis: Array<string>, // e.g. :smile:, :tada:
  onHidden: () => void,
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

class HoverEmoji extends React.Component<{name: string, onClick: () => void}, {hovering: boolean}> {
  state = {hovering: false}
  _setHovering = () => this.setState(s => (s.hovering ? null : {hovering: true}))
  _setNotHovering = () => this.setState(s => (!s.hovering ? null : {hovering: false}))
  render() {
    return (
      <Kb.ClickableBox
        onClick={this.props.onClick}
        onMouseOver={this._setHovering}
        onMouseLeave={this._setNotHovering}
        style={styles.emojiBox}
      >
        <Kb.Emoji size={this.state.hovering ? 22 : 16} emojiName={this.props.name} />
      </Kb.ClickableBox>
    )
  }
}

const EmojiRow = (props: Props) => (
  <>
    {props.visible && (
      <Kb.FloatingBox
        attachTo={props.attachTo}
        onHidden={props.onHidden}
        position="bottom right"
        containerStyle={props.style}
      >
        <HoverBox direction="horizontal" style={styles.innerContainer}>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.emojisRow}>
            {props.emojis.map(e => (
              <HoverEmoji name={e} key={e} onClick={() => props.onReact(e)} />
            ))}
          </Kb.Box2>
        </HoverBox>
      </Kb.FloatingBox>
    )}
  </>
)

const styles = Styles.styleSheetCreate({
  emojiBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    position: 'relative',
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
})

export default EmojiRow
