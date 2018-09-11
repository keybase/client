// @flow
import * as React from 'react'
import {isMobile} from '../util/container'
import HeaderHoc from './header-hoc'
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

function Popup<P: {}>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel}>
      <Wrapped {...(props: P)} />
    </PopupDialog>
  )
  return PopupWrapper
}

export default HeaderOrPopup
