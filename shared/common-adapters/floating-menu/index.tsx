// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import {Position} from '../relative-popup-hoc.types'
import MenuLayout, {MenuItem, MenuItems} from './menu-layout'
import {Color, StylesCrossPlatform} from '../../styles'

export type Props = {
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: StylesCrossPlatform
  items: MenuItems
  header?: MenuItem
  backgroundColor?: Color
  listStyle?: Object
  onHidden: () => void
  visible: boolean
  attachTo?: () => React.Component<any> | null
  position?: Position
  positionFallbacks?: Position[]
  propagateOutsideClicks?: boolean
  textColor?: Color
}

export default (props: Props) => {
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
