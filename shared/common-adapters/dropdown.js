// @flow
import * as React from 'react'
import Box from './box'
import Overlay from './overlay'
import OverlayParentHOC, {type OverlayParentProps} from './overlay/parent-hoc'
import type {Position} from './relative-popup-hoc'
import Icon from './icon'
import * as Styles from '../styles'

type Props = {
  onChanged: (selected: React.Node) => void,
  selected?: React.Node,
  items: Array<React.Node>,
  style?: Styles.StylesCrossPlatform,
  position?: Position,
  disabled?: boolean,
}
type State = {
  expanded: boolean,
}

class Dropdown extends React.Component<Props & OverlayParentProps, State> {
  state = {expanded: false}

  static defaultProps = {
    disabled: false,
  }

  _toggleOpen = () => {
    this.setState(prevState => ({
      expanded: !prevState.expanded,
    }))
  }

  _onSelect = (n: React.Node) => {
    this.props.onChanged && this.props.onChanged(n)
    this.setState({expanded: false})
  }

  render() {
    return (
      <Box style={Styles.collapseStyles([{width: Styles.isMobile ? '100%' : 270}, this.props.style])}>
        <ButtonBox
          onClick={!this.props.disabled ? this._toggleOpen : null}
          disabled={this.props.disabled}
          ref={this.props.setAttachmentRef}
        >
          <Box style={styles.selectedBox}>{this.props.selected}</Box>
          <Icon
            type="iconfont-caret-down"
            inheritColor={true}
            fontSize={Styles.isMobile ? 12 : 8}
            style={{marginTop: Styles.isMobile ? 4 : -8}}
          />
        </ButtonBox>
        <Overlay
          style={styles.overlay}
          attachTo={this.props.getAttachmentRef}
          visible={this.state.expanded}
          onHidden={this._toggleOpen}
          position={this.props.position || 'center center'}
        >
          {this.props.items.map((i, idx) => (
            <ItemBox key={idx} onClick={() => this._onSelect(i)}>
              {i}
            </ItemBox>
          ))}
        </Overlay>
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  selectedBox: Styles.platformStyles({
    isMobile: {minHeight: 48},
    isElectron: {minHeight: 32},
    common: {
      ...Styles.globalStyles.flexBoxCenter,
      width: '100%',
    },
  }),
  overlay: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.scrollable,
      border: `1px solid ${Styles.globalColors.blue}`,
      borderRadius: 4,
      maxHeight: 300,
      width: 270,
    },
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.white,
      marginTop: Styles.globalMargins.xtiny,
    },
    // TODO: make sure mobile looks alright
  }),
})

const ItemBox = Styles.glamorous(Box)({
  ...Styles.globalStyles.flexBoxRow,
  ...(Styles.isMobile
    ? {}
    : {
        ':hover': {
          backgroundColor: Styles.globalColors.blue4,
        },
      }),
  borderBottomWidth: 1,
  borderColor: Styles.globalColors.black_10,
  borderStyle: 'solid',
  minHeight: 32,
  width: '100%',
})

const ButtonBox = Styles.glamorous(Box)(props => ({
  ...Styles.globalStyles.flexBoxRow,
  ...(!props.disabled && !Styles.isMobile
    ? {
        ':hover': {border: `solid 1px ${Styles.globalColors.blue}`, color: Styles.globalColors.blue},
        cursor: 'pointer',
      }
    : {}),
  ...(props.disabled ? {opacity: 0.3} : {}),
  alignItems: 'center',
  borderColor: Styles.globalColors.black_10,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 1,
  color: Styles.globalColors.black_40,
  paddingRight: Styles.isMobile ? Styles.globalMargins.large : Styles.globalMargins.small,
  width: '100%',
}))

export default OverlayParentHOC(Dropdown)
