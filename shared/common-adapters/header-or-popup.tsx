import * as React from 'react'
import {isMobile} from '../util/container'
import {HeaderHocHeader, HeaderHocWrapper, Props as HeaderHocProps} from './header-hoc'
import PopupDialog, {Props as PopupDialogProps} from './popup-dialog'
import * as Styles from '../styles'

/** TODO only use this **/
export const PopupWrapper = (props: PopupDialogProps & HeaderHocProps & {children: React.ReactNode}) => {
  if (isMobile) {
    const {children, ...rest} = props
    return <HeaderHocWrapper {...rest}>{children}</HeaderHocWrapper>
  } else {
    return <PopupDialog onClose={props.onCancel}>{props.children}</PopupDialog>
  }
}
/** TODO deprecate eventually **/
export const PopupWithHeaderWrapper = (
  props: PopupDialogProps & HeaderHocProps & {children: React.ReactNode; style?: Styles.StylesCrossPlatform}
) => {
  if (isMobile) {
    const {children, ...rest} = props
    return <HeaderHocWrapper {...rest}>{children}</HeaderHocWrapper>
  } else {
    const {onCancel, style, onBack, children} = props
    return (
      <PopupDialog onClose={onCancel} styleClipContainer={style}>
        {onBack && <HeaderHocHeader onBack={onBack} headerStyle={headerStyle} />}
        {children}
      </PopupDialog>
    )
  }
}

const headerStyle = {
  backgroundColor: Styles.globalColors.transparent,
}
