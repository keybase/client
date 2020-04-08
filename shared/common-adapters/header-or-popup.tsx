import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {HeaderHocWrapper, Props as HeaderHocProps} from './header-hoc'
import PopupDialog, {Props as PopupDialogProps} from './popup-dialog'

export const PopupWrapper = (props: PopupDialogProps & HeaderHocProps & {children: React.ReactNode}) => {
  if (Container.isMobile) {
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

type Props = {children: React.ReactNode}
export const PopupDialogDesktop: (p: Props) => React.ReactElement = Container.isMobile
  ? (props: Props) => props.children as React.ReactElement
  : (props: Props) => {
      const dispatch = Container.useDispatch()
      const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
      return <PopupDialog onClose={onBack}>{props.children}</PopupDialog>
    }
