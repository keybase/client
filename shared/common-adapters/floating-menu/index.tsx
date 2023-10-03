// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import MenuLayout, {type MenuItems as _MenuItems} from './menu-layout'
import * as Styles from '../../styles'

export type MenuItems = _MenuItems

export type Props = {
  attachTo?: () => React.Component<any> | null
  backgroundColor?: Styles.Color
  closeOnSelect: boolean
  closeText?: string // mobile only; default to "Close",
  containerStyle?: Styles.StylesCrossPlatform
  header?: React.ReactNode
  items: ReadonlyArray<_MenuItems[0]>
  listStyle?: Object
  onHidden: () => void
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  textColor?: Styles.Color
  visible: boolean
  // mobile only
  safeProviderStyle?: Styles.StylesCrossPlatform
}

const FloatingMenu = (props: Props) => {
  const isModal = React.useContext(FloatingModalContext)

  if (!props.visible && !isModal) {
    return null
  }

  const contents = (
    <MenuLayout
      header={props.header}
      onHidden={props.onHidden}
      items={props.items}
      closeOnClick={props.closeOnSelect}
      closeText={props.closeText}
      listStyle={props.listStyle}
      textColor={props.textColor}
      backgroundColor={props.backgroundColor}
      safeProviderStyle={props.safeProviderStyle}
    />
  )

  if (isModal) {
    return contents
  }

  return (
    <Overlay
      position={props.position}
      positionFallbacks={props.positionFallbacks}
      onHidden={props.onHidden}
      visible={props.visible}
      attachTo={props.attachTo}
      remeasureHint={props.remeasureHint}
      style={Styles.collapseStyles([props.containerStyle])}
      propagateOutsideClicks={props.propagateOutsideClicks}
    >
      {contents}
    </Overlay>
  )
}
export default FloatingMenu

// escape hatch to make a floating to a modal
export const FloatingModalContext = React.createContext(false)
