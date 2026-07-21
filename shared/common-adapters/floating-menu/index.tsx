import * as React from 'react'
import Popup from '../popup'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import MenuLayout from './menu-layout'
import type {MenuItems as _MenuItems} from './menu-layout/index.shared'
import type * as Styles from '@/styles'
import {NavigationContext} from '@react-navigation/core'

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: React.RefObject<MeasureRef | null>
  backgroundColor?: Styles.Color
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: Styles.StylesCrossPlatform
  header?: React.ReactNode
  items: ReadonlyArray<_MenuItems[number]>
  listStyle?: object
  mode?: 'modal' | 'bottomsheet'
  onHidden: () => void
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  textColor?: Styles.Color
  visible: boolean
  offset?: number
  // mobile only
  safeProviderStyle?: Styles.StylesCrossPlatform
  snapPoints?: Array<string | number>
}

// useNavigation() throws when called outside a navigator (e.g. inside a gorhom
// portal rendered at popup-root, which is a sibling to the router). Using the
// context directly returns undefined instead of throwing.
const useSafeNavigation = isMobile
  ? () => React.useContext(NavigationContext) ?? null
  : () => null

function FloatingMenu(props: Props) {
  const {items, visible, onHidden, mode} = props

  const navigation = useSafeNavigation()

  React.useEffect(() => {
    const unsub = navigation?.addListener('state', () => {
      onHidden()
    })
    return unsub
  }, [navigation, onHidden])

  // modal mode callers control mounting themselves; sheets present on mount so
  // they must unmount when not visible
  if (!visible && mode !== 'modal') {
    return null
  }

  const contents = (
    <MenuLayout
      isModal={mode ?? false}
      header={props.header}
      onHidden={props.onHidden}
      items={items}
      closeOnClick={props.closeOnSelect}
      closeText={props.closeText}
      listStyle={props.listStyle}
      textColor={props.textColor}
      backgroundColor={props.backgroundColor}
      safeProviderStyle={props.safeProviderStyle}
    />
  )

  if (mode === 'modal') {
    return contents
  }

  return (
    <Popup
      attachTo={props.attachTo}
      onHidden={onHidden}
      visible={props.visible}
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      propagateOutsideClicks={props.propagateOutsideClicks}
      remeasureHint={props.remeasureHint}
      offset={props.offset}
      style={props.containerStyle}
      snapPoints={props.snapPoints}
    >
      {contents}
    </Popup>
  )
}

export default FloatingMenu
