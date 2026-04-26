import * as React from 'react'
import Popup from '../popup'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import MenuLayout, {type MenuItems as _MenuItems} from './menu-layout'
import * as Styles from '@/styles'
import {useNavigation, type NavigationProp, type ParamListBase} from '@react-navigation/native'

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: React.RefObject<MeasureRef | null> | undefined
  backgroundColor?: Styles.Color | undefined
  closeOnSelect: boolean
  closeText?: string | undefined // mobile only; default to "Close",
  containerStyle?: Styles.StylesCrossPlatform | undefined
  header?: React.ReactNode | undefined
  items: ReadonlyArray<_MenuItems[number]>
  listStyle?: object | undefined
  mode?: 'modal' | 'bottomsheet' | undefined
  onHidden: () => void
  position?: Styles.Position | undefined
  positionFallbacks?: ReadonlyArray<Styles.Position> | undefined
  propagateOutsideClicks?: boolean | undefined
  remeasureHint?: number | undefined
  textColor?: Styles.Color | undefined
  visible: boolean
  offset?: number | undefined
  // mobile only
  safeProviderStyle?: Styles.StylesCrossPlatform | undefined
  snapPoints?: Array<string | number> | undefined
}

type SafeNavigationHook = <T extends NavigationProp<ParamListBase>>() => T | null

const useSafeNavigation: SafeNavigationHook = Styles.isMobile
  ? (useNavigation as SafeNavigationHook)
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

  if (!visible && !mode) {
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
      attachTo={mode === 'bottomsheet' && Styles.isMobile ? undefined : props.attachTo}
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
