// @flow
import * as React from 'react'
import Box from './box'
import ClickableBox from './clickable-box'
import Overlay from './overlay'
import ScrollView from './scroll-view'
import OverlayParentHOC, {type OverlayParentProps} from './overlay/parent-hoc'
import type {Position} from './relative-popup-hoc'
import Icon from './icon'
import * as Styles from '../styles'

type Props = {
  onChanged: (selected: React.Node) => void,
  selected?: React.Node,
  items: Array<React.Node>,
  style?: Styles.StylesCrossPlatform,
  selectedBoxStyle?: Styles.StylesCrossPlatform,
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
        <ClickableBox onClick={!this.props.disabled ? this._toggleOpen : null}>
          <ButtonBox disabled={this.props.disabled} ref={this.props.setAttachmentRef}>
            <Box style={Styles.collapseStyles([styles.selectedBox, this.props.selectedBoxStyle])}>
              {this.props.selected}
            </Box>
            <Icon
              type="iconfont-caret-down"
              inheritColor={true}
              fontSize={Styles.isMobile ? 12 : 8}
              style={{marginTop: Styles.isMobile ? 4 : -8}}
            />
          </ButtonBox>
        </ClickableBox>
        <Overlay
          style={styles.overlay}
          attachTo={this.props.getAttachmentRef}
          visible={this.state.expanded}
          onHidden={this._toggleOpen}
          position={this.props.position || 'center center'}
        >
          <ScrollView style={styles.scrollView}>
            {this.props.items.map((i, idx) => (
              <ClickableBox key={idx} onClick={() => this._onSelect(i)} style={styles.itemClickBox}>
                <ItemBox>{i}</ItemBox>
              </ClickableBox>
            ))}
          </ScrollView>
        </Overlay>
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  itemClickBox: Styles.platformStyles({
    common: {
      width: '100%',
      flexShrink: 0,
    },
    isMobile: {
      minHeight: 40,
    },
  }),
  scrollView: Styles.platformStyles({
    common: {
      width: '100%',
      height: '100%',
    },
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      maxHeight: '50%',
    },
  }),
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
  minHeight: Styles.isMobile ? 40 : 32,
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
  borderRadius: Styles.borderRadius,
  borderStyle: 'solid',
  borderWidth: 1,
  color: Styles.globalColors.black_40,
  paddingRight: Styles.isMobile ? Styles.globalMargins.large : Styles.globalMargins.small,
  width: '100%',
}))

export default OverlayParentHOC(Dropdown)
