// @flow
import * as React from 'react'
import FloatingBox from './floating-box'
import type {Position} from './relative-popup-hoc'
import PopupMenu, {type MenuItem, ModalLessPopupMenu} from './popup-menu'
import {isMobile} from '../constants/platform'

export type Props = {
  closeOnSelect?: boolean,
  items: Array<MenuItem | 'Divider' | null>,
  header?: MenuItem,
  onHidden: () => void,
  visible: boolean,
  attachTo?: ?React.Component<*, *>,
  position?: Position,
  gatewayName: string,
}

export default (props: Props) => {
  if (!props.visible) {
    return null
  }
  const PopupComponent = isMobile ? PopupMenu : ModalLessPopupMenu
  return (
    <FloatingBox
      position={props.position}
      onHidden={props.onHidden}
      visible={props.visible}
      attachTo={props.attachTo}
      gatewayName={props.gatewayName}
    >
      <PopupComponent
        header={props.header}
        onHidden={props.onHidden}
        items={props.items}
        closeOnClick={!!props.closeOnSelect}
      />
    </FloatingBox>
  )
}
