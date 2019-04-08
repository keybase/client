import * as React from 'react'
import {isMobile} from '../util/container'
import HeaderHoc, {HeaderHocHeader} from './header-hoc'
import PopupDialog from './popup-dialog'
import * as Styles from '../styles'
import { Props } from './header-or-popup';

// HeaderOrPopup replaces our common pattern of:
// isMobile
//   ? HeaderHoc(Foo)
//   : <PopupDialog>
//       <Foo />
//     </PopupDialog>
function HeaderOrPopup<P extends {}>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : Popup(WrappedComponent)
}

// Same as above but the Popup itself has a header
export function HeaderOrPopupWithHeader<P extends {}>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : PopupWithHeader(WrappedComponent)
}

function Popup<P extends {}>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel}>
      <Wrapped {...(props as P)} />
    </PopupDialog>
  )
  return PopupWrapper
}

function PopupWithHeader<P extends {}>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel} styleClipContainer={props.style}>
      {props.onBack && <HeaderHocHeader onBack={props.onBack} headerStyle={headerStyle} />}
      <Wrapped {...(props as P)} />
    </PopupDialog>
  )
  return PopupWrapper
}

const headerStyle = {
  backgroundColor: Styles.globalColors.transparent,
}

export default HeaderOrPopup
