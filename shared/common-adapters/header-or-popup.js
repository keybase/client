// @flow
import * as React from 'react'
import {isMobile} from '../util/container'
import HeaderHoc, {HeaderHocHeader} from './header-hoc'
import PopupDialog from './popup-dialog'
import type {Props} from './header-or-popup'

// HeaderOrPopup replaces our common pattern of:
// isMobile
//   ? HeaderHoc(Foo)
//   : <PopupDialog>
//       <Foo />
//     </PopupDialog>
function HeaderOrPopup<P: {}>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : Popup(WrappedComponent)
}

// Same as above but the Popup itself has a header
export function HeaderOrPopupWithHeader<P: {}>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : PopupWithHeader(WrappedComponent)
}

function Popup<P: {}>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel}>
      <Wrapped {...(props: P)} />
    </PopupDialog>
  )
  return PopupWrapper
}

function PopupWithHeader<P: {}>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel}>
      <HeaderHocHeader onBack={props.onBack} />
      <Wrapped {...(props: P)} />
    </PopupDialog>
  )
  return PopupWrapper
}

export default HeaderOrPopup
