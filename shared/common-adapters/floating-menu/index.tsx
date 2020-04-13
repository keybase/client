// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import {Position} from '../relative-popup-hoc.types'
import MenuLayout, {MenuItems as _MenuItems} from './menu-layout'
import {Color, StylesCrossPlatform} from '../../styles'

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: () => React.Component<any> | null
  backgroundColor?: Color
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: StylesCrossPlatform
  header?: React.ReactNode
  items: _MenuItems
  listStyle?: Object
  onHidden: () => void
  position?: Position
  positionFallbacks?: Position[]
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  textColor?: Color
  visible: boolean
}

const FloatingMenu = (props: Props) => {
  if (!props.visible) {
    return null
  }
  return (
    <Overlay
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      onHidden={props.onHidden}
      visible={props.visible}
      attachTo={props.attachTo}
      remeasureHint={props.remeasureHint}
      style={props.containerStyle}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      <MenuLayout
        header={props.header}
        onHidden={props.onHidden}
        items={props.items}
        closeOnClick={props.closeOnSelect}
        closeText={props.closeText}
        listStyle={props.listStyle}
        textColor={props.textColor}
        backgroundColor={props.backgroundColor}
      />
    </Overlay>
  )
}
export default FloatingMenu
