// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import MenuLayout, {type MenuItems as _MenuItems} from './menu-layout'
import type {Position, Color, StylesCrossPlatform} from '../../styles'

// if we don't want to actually pop it up
export const InlineFloatingMenuContext = React.createContext(false)

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: () => React.Component<any> | null
  backgroundColor?: Color
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: StylesCrossPlatform
  header?: React.ReactNode
  items: ReadonlyArray<_MenuItems[0]>
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
  const inline = React.useContext(InlineFloatingMenuContext)

  if (!props.visible) {
    return null
  }

  const layout = (
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
  )

  if (inline) {
    return layout
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
      {layout}
    </Overlay>
  )
}
export default FloatingMenu
