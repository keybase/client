import * as React from 'react'
import Box, {Box2} from './box'
import ProgressIndicator from './progress-indicator'
import ClickableBox from './clickable-box'
import Text from './text'
import Overlay from './overlay'
import ScrollView from './scroll-view'
import Icon from './icon'
import {smallHeight, regularHeight} from './button'
import {usePopup} from './use-popup'
import * as Styles from '../styles'
import './dropdown.css'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  Icon,
  Overlay,
  ProgressIndicator,
  ScrollView,
  Text,
  usePopup,
}

type DropdownButtonProps = {
  disabled?: boolean
  selected?: React.ReactNode
  selectedBoxStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
  popupAnchor?: React.MutableRefObject<Box | null>
  toggleOpen: (e: React.BaseSyntheticEvent) => void
  inline?: boolean
  loading?: boolean
}
export const DropdownButton = (props: DropdownButtonProps) => (
  <Kb.ClickableBox
    onClick={!props.disabled ? props.toggleOpen : undefined}
    style={Styles.collapseStyles([styles.dropdownBoxContainer, props.style])}
  >
    <Kb.Box
      ref={props.popupAnchor as any}
      className={Styles.classNames('dropdown_border', {
        hover: !props.disabled,
      })}
      style={{
        ...Styles.globalStyles.flexBoxRow,
        ...(props.disabled ? {opacity: 0.3} : {}),
        alignItems: 'center',
        ...(Styles.isMobile
          ? {
              borderColor: Styles.globalColors.black_10,
              color: Styles.globalColors.black_50,
            }
          : {}),
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        cursor: !props.disabled ? 'pointer' : undefined,
        paddingRight: props.inline
          ? Styles.globalMargins.tiny
          : Styles.isMobile
          ? Styles.globalMargins.large
          : Styles.globalMargins.small,
        width: props.inline ? undefined : '100%',
        ...(Styles.isTablet ? {maxWidth: 460} : {}),
      }}
    >
      <Kb.Box style={Styles.collapseStyles([styles.selectedBox, props.selectedBoxStyle])}>
        {props.loading ? <Kb.ProgressIndicator type="Small" /> : props.selected}
      </Kb.Box>
      <Kb.Icon
        type="iconfont-caret-down"
        inheritColor={true}
        sizeType="Tiny"
        style={{marginTop: Styles.isMobile ? 2 : -8}}
      />
    </Kb.Box>
  </Kb.ClickableBox>
)

type Props<N> = {
  disabled?: boolean
  itemBoxStyle?: Styles.StylesCrossPlatform
  items: Array<N>
  onChanged?: (selected: N) => void
  onChangedIdx?: (selectedIdx: number) => void
  overlayStyle?: Styles.StylesCrossPlatform
  position?: Styles.Position
  selected?: N
  selectedBoxStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
}

function Dropdown<N>(p: Props<N>) {
  const disabled = p.disabled ?? false
  const {style, onChanged, onChangedIdx, overlayStyle, selectedBoxStyle} = p
  const {position, itemBoxStyle, items, selected} = p

  const {toggleShowingPopup, showingPopup, setShowingPopup, popup, popupAnchor} = Kb.usePopup<Box>(
    attachTo => (
      <Kb.Overlay
        style={Styles.collapseStyles([styles.overlay, overlayStyle])}
        attachTo={attachTo}
        visible={showingPopup}
        onHidden={toggleOpen}
        position={position || 'center center'}
      >
        <Kb.ScrollView style={styles.scrollView}>
          {items.map((i: N, idx) => (
            <Kb.ClickableBox
              key={idx}
              onClick={evt => {
                evt?.stopPropagation?.()
                evt?.preventDefault?.()
                // Bug in flow that doesn't let us just call this function
                // onSelect(i)
                onChanged?.(i)
                onChangedIdx?.(idx)
                setShowingPopup(false)
              }}
              style={styles.itemClickBox}
            >
              <Kb.Box
                style={Styles.collapseStyles([styles.itemBox, itemBoxStyle])}
                className="hover_background_color_blueLighter2"
              >
                {i}
              </Kb.Box>
            </Kb.ClickableBox>
          ))}
        </Kb.ScrollView>
      </Kb.Overlay>
    )
  )

  const toggleOpen = React.useCallback(
    (evt?: React.BaseSyntheticEvent) => {
      evt?.stopPropagation?.()
      evt?.preventDefault?.()
      toggleShowingPopup()
    },
    [toggleShowingPopup]
  )

  return (
    <Kb.Box style={Styles.collapseStyles([styles.overlayContainer, style])}>
      <DropdownButton
        disabled={disabled}
        selected={selected as any}
        selectedBoxStyle={selectedBoxStyle}
        popupAnchor={popupAnchor}
        toggleOpen={toggleOpen}
      />
      {popup}
    </Kb.Box>
  )
}

type InlineDropdownProps = {
  containerStyle?: Styles.StylesCrossPlatform
  onPress: () => void
  style?: Styles.StylesCrossPlatform
  loading?: boolean
  selectedStyle?: Styles.StylesCrossPlatform
} & (
  | {
      textWrapperType: null
      label: React.ReactElement
    }
  | {
      textWrapperType: 'Body' | 'BodySemibold' | 'BodySmall' | 'BodySmallSemibold'
      label: string
    }
)

export const InlineDropdown = (props: InlineDropdownProps) => {
  const selected = (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.inlineSelected, props.selectedStyle])}
    >
      {props.textWrapperType ? <Kb.Text type={props.textWrapperType}>{props.label}</Kb.Text> : props.label}
    </Kb.Box2>
  )
  return (
    <DropdownButton
      inline={true}
      loading={props.loading}
      style={Styles.collapseStyles([styles.inlineDropdown, props.containerStyle])}
      toggleOpen={e => {
        e.stopPropagation && e.stopPropagation()
        props.onPress && props.onPress()
      }}
      selectedBoxStyle={Styles.collapseStyles([styles.inlineDropdownSelected, props.style])}
      selected={selected}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  dropdownBoxContainer: Styles.platformStyles({
    isTablet: {
      maxWidth: 460,
    },
  }),
  inlineDropdown: {
    paddingRight: Styles.globalMargins.tiny,
  },
  inlineDropdownSelected: Styles.platformStyles({
    common: {minHeight: smallHeight},
    isMobile: {width: undefined},
  }),
  inlineSelected: Styles.platformStyles({
    common: {
      alignItems: 'center',
      flexShrink: 0,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  itemBox: {
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    minHeight: Styles.isMobile ? 40 : 32,
    width: '100%',
  },
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
  overlayContainer: Styles.platformStyles({
    isElectron: {
      width: 270,
    },
    isMobile: {
      width: '100%',
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
  selectedBox: {
    ...Styles.globalStyles.flexBoxCenter,
    minHeight: regularHeight,
    width: '100%',
  },
}))

export default Dropdown
