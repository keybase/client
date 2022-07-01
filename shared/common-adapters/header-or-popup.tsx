import * as React from 'react'
import {isMobile} from '../util/container'
import {HeaderHocWrapper, Props as HeaderHocProps} from './header-hoc'
import PopupDialog, {Props as PopupDialogProps} from './popup-dialog'

export const PopupWrapper = (props: PopupDialogProps & HeaderHocProps & {children: React.ReactNode}) => {
  if (isMobile) {
    const {children, ...rest} = props
    return <HeaderHocWrapper {...rest}>{children}</HeaderHocWrapper>
  } else {
    return (
      <PopupDialog onClose={props.onCancel} styleClipContainer={props.styleClipContainer}>
        {props.children}
      </PopupDialog>
    )
  }
}
