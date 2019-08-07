import * as React from 'react'
import Box, {Box2} from './box'
import ClickableBox from './clickable-box'
import Text from './text'
import Overlay from './overlay'
import ScrollView from './scroll-view'
import OverlayParentHOC, {OverlayParentProps} from './overlay/parent-hoc'
import {Position} from './relative-popup-hoc.types'
import Icon from './icon'
import * as Styles from '../styles'

type DropdownButtonProps = {
  disabled?: boolean
  selected?: React.ReactNode
  selectedBoxStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
  setAttachmentRef?: (arg0: React.Component<any> | null) => void
  toggleOpen: (e: React.BaseSyntheticEvent) => void
  inline?: boolean
}
export const DropdownButton = (props: DropdownButtonProps) => (
  <ClickableBox onClick={!props.disabled ? props.toggleOpen : undefined} style={props.style}>
    <ButtonBox inline={props.inline} disabled={props.disabled} ref={props.setAttachmentRef}>
      <Box style={Styles.collapseStyles([styles.selectedBox, props.selectedBoxStyle])}>{props.selected}</Box>
      <Icon
        type="iconfont-caret-down"
        inheritColor={true}
        sizeType="Tiny"
        style={{marginTop: Styles.isMobile ? 2 : -8}}
      />
    </ButtonBox>
  </ClickableBox>
)

type Props<N> = {
  disabled?: boolean
  itemBoxStyle?: Styles.StylesCrossPlatform
  items: Array<N>
  onChanged?: (selected: N) => void
  onChangedIdx?: (selectedIdx: number) => void
  overlayStyle?: Styles.StylesCrossPlatform
  position?: Position
  selected?: N
  selectedBoxStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
}

type State = {
  expanded: boolean
}

class Dropdown<N extends React.ReactNode> extends React.Component<Props<N> & OverlayParentProps, State> {
  state = {expanded: false}

  static defaultProps = {
    disabled: false,
  }

  _toggleOpen = (evt?: React.BaseSyntheticEvent) => {
    evt && evt.stopPropagation && evt.stopPropagation()
    evt && evt.preventDefault && evt.preventDefault()
    this.setState(prevState => ({
      expanded: !prevState.expanded,
    }))
  }

  _onSelect = () => {
    this.setState({expanded: false})
  }

  render() {
    return (
      <Box style={Styles.collapseStyles([{width: Styles.isMobile ? '100%' : 270}, this.props.style])}>
        <DropdownButton
          disabled={this.props.disabled}
          selected={this.props.selected}
          selectedBoxStyle={this.props.selectedBoxStyle}
          setAttachmentRef={this.props.setAttachmentRef}
          toggleOpen={this._toggleOpen}
        />
        <Overlay
          style={Styles.collapseStyles([styles.overlay, this.props.overlayStyle])}
          attachTo={this.props.getAttachmentRef}
          visible={this.state.expanded}
          onHidden={this._toggleOpen}
          position={this.props.position || 'center center'}
        >
          <ScrollView style={styles.scrollView}>
            {this.props.items.map((i: N, idx) => (
              <ClickableBox
                key={idx}
                onClick={evt => {
                  evt.stopPropagation && evt.stopPropagation()
                  evt.preventDefault && evt.preventDefault()
                  // Bug in flow that doesn't let us just call this function
                  // this._onSelect(i)
                  this.props.onChanged && this.props.onChanged(i)
                  this.props.onChangedIdx && this.props.onChangedIdx(idx)
                  this._onSelect()
                }}
                style={styles.itemClickBox}
              >
                <ItemBox style={this.props.itemBoxStyle}>{i}</ItemBox>
              </ClickableBox>
            ))}
          </ScrollView>
        </Overlay>
      </Box>
    )
  }
}

type InlineDropdownProps = {
  label: string
  onPress: () => void
  type: 'Body' | 'BodySmall'
}

export const InlineDropdown = (props: InlineDropdownProps) => {
  const selected = (
    <Box2 direction="horizontal" key={props.label} style={styles.inlineSelected}>
      <Text type={props.type}>{props.label}</Text>
    </Box2>
  )
  return (
    <DropdownButton
      inline={true}
      style={styles.inlineDropdown}
      toggleOpen={e => {
        e.stopPropagation && e.stopPropagation()
        props.onPress && props.onPress()
      }}
      selectedBoxStyle={styles.inlineDropdownSelected}
      selected={selected}
    />
  )
}

const styles = Styles.styleSheetCreate({
  inlineDropdown: {
    paddingRight: Styles.globalMargins.tiny,
  },
  inlineDropdownSelected: Styles.platformStyles({
    isElectron: {minHeight: 22},
    isMobile: {minHeight: 30, width: undefined},
  }),
  inlineSelected: Styles.platformStyles({
    common: {
      alignItems: 'center',
      flexShrink: 0,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  itemClickBox: Styles.platformStyles({
    common: {
      flexShrink: 0,
      width: '100%',
    },
    isMobile: {
      minHeight: 40,
    },
  }),
  overlay: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      backgroundColor: Styles.globalColors.white,
      marginTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      border: `1px solid ${Styles.globalColors.blue}`,
      borderRadius: 4,
      maxHeight: 300,
      width: 270,
    },
  }),
  scrollView: Styles.platformStyles({
    common: {
      height: '100%',
      width: '100%',
    },
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      maxHeight: '50%',
    },
  }),
  selectedBox: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxCenter,
      width: '100%',
    },
    isElectron: {minHeight: 32},
    isMobile: {minHeight: 48},
  }),
})

const ItemBox = Styles.styled(Box)({
  ...Styles.globalStyles.flexBoxRow,
  ...(Styles.isMobile
    ? {}
    : {
        ':hover': {
          backgroundColor: Styles.globalColors.blueLighter2,
        },
      }),
  borderBottomWidth: 1,
  borderColor: Styles.globalColors.black_10,
  borderStyle: 'solid',
  minHeight: Styles.isMobile ? 40 : 32,
  width: '100%',
})

// @ts-ignore styled can have more than one argument
const ButtonBox = Styles.styled(Box, {shouldForwardProp: prop => prop !== 'inline'})(props => ({
  ...Styles.globalStyles.flexBoxRow,
  ...(!props.disabled && !Styles.isMobile
    ? {
        ':hover': {border: `solid 1px ${Styles.globalColors.blue}`, color: Styles.globalColors.blueDark},
        cursor: 'pointer',
      }
    : {}),
  ...(props.disabled ? {opacity: 0.3} : {}),
  alignItems: 'center',
  borderColor: Styles.globalColors.black_10,
  borderRadius: Styles.borderRadius,
  borderStyle: 'solid',
  borderWidth: 1,
  color: Styles.globalColors.black_50,
  paddingRight: props.inline
    ? Styles.globalMargins.tiny
    : Styles.isMobile
    ? Styles.globalMargins.large
    : Styles.globalMargins.small,
  width: props.inline ? undefined : '100%',
}))

// This whole wrapper exists so as to get proper typing on the export, so
// that things can use Dropdown with the properly typed Props. This could
// be cleaner, probably, but it's probably not worth spending too much time
// on as hopefully we'll be moving to hooks for our HOCs
class OverlayDropdown<N extends React.ReactNode> extends React.Component<Props<N>> {
  private Container: React.Component<Props<N> & OverlayParentProps>

  constructor(props: Props<N>) {
    super(props)
    // @ts-ignore
    this.Container = OverlayParentHOC(Dropdown)
  }

  render() {
    // @ts-ignore
    return <this.Container {...this.props} />
  }
}

export default OverlayDropdown
