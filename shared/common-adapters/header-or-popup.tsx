import * as React from 'react'
import {isMobile, hoistNonReactStatic} from '../util/container'
import HeaderHoc, {HeaderHocHeader, HeaderHocWrapper} from './header-hoc'
import PopupDialog from './popup-dialog'
import * as Styles from '../styles'
import {Props} from './header-or-popup.d'

/** TODO only use this **/
export const PopupWrapper = (props: {onCancel?: () => void; children: React.ReactNode}) => {
  const {onCancel, children} = props
  if (isMobile) {
    return <HeaderHocWrapper onCancel={onCancel}>{children}</HeaderHocWrapper>
  } else {
    return <PopupDialog onClose={onCancel}>{children}</PopupDialog>
  }
}
/** TODO deprecate eventually **/
export const PopupWitHeaderWrapper = (props: {
  onCancel?: () => void
  children: React.ReactNode
  style?: Styles.StylesCrossPlatform
  onBack?: () => void
}) => {
  const {onCancel, children, style, onBack} = props
  if (isMobile) {
    return <HeaderHocWrapper onCancel={onCancel}>{children}</HeaderHocWrapper>
  } else {
    return (
      <PopupDialog onClose={onCancel} styleClipContainer={style}>
        {onBack && <HeaderHocHeader onBack={onBack} headerStyle={headerStyle} />}
        {children}
      </PopupDialog>
    )
  }
}

// HeaderOrPopup replaces our common pattern of:
// isMobile
//   ? HeaderHoc(Foo)
//   : <PopupDialog>
//       <Foo />
//     </PopupDialog>
/** TODO deprecate **/
function HeaderOrPopup<P>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : Popup(WrappedComponent)
}

// Same as above but the Popup itself has a header
/** TODO deprecate **/
export function HeaderOrPopupWithHeader<P>(WrappedComponent: React.ComponentType<P>) {
  return isMobile ? HeaderHoc(WrappedComponent) : PopupWithHeader(WrappedComponent)
}

/** TODO deprecate **/
function Popup<P>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel}>
      <Wrapped {...(props as P)} />
    </PopupDialog>
  )
  hoistNonReactStatic(PopupWrapper, Wrapped)
  return PopupWrapper
}

/** TODO deprecate **/
function PopupWithHeader<P>(Wrapped: React.ComponentType<P>) {
  const PopupWrapper = (props: P & Props) => (
    <PopupDialog onClose={props.onCancel} styleClipContainer={props.style}>
      {props.onBack && <HeaderHocHeader onBack={props.onBack} headerStyle={headerStyle} />}
      <Wrapped {...(props as P)} />
    </PopupDialog>
  )
  hoistNonReactStatic(PopupWrapper, Wrapped)
  return PopupWrapper
}

const headerStyle = {
  backgroundColor: Styles.globalColors.transparent,
}

export default HeaderOrPopup
