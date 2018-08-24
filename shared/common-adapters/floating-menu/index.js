// @flow

// For stories, all popups using FloatingMenu will need to have a PropProvider
// decorator added to the story. This is because FloatingMenus are rendered
// into a GatewayDest component in a storybook context. GatewayDest is only
// rendered if a PropProvider decorated is used. This is done so that connected
// components inside of a popup have access to the mocked out Provider component

import * as React from 'react'
import Overlay from '../overlay'
import type {Position} from '../relative-popup-hoc'
import MenuLayout, {type MenuItem} from './menu-layout'
import {type StylesCrossPlatform} from '../../styles'

export type Props = {|
  closeOnSelect: boolean,
  containerStyle?: StylesCrossPlatform,
  items: Array<MenuItem | 'Divider' | null>,
  header?: MenuItem,
  onHidden: () => void,
  visible: boolean,
  attachTo?: ?React.Component<any, any>,
  position?: Position,
  positionFallbacks?: Position[],
  propagateOutsideClicks?: boolean,
|}

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
      />
    </Overlay>
  )
}
