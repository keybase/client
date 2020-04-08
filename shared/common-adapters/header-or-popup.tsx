import * as React from 'react'
import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {HeaderHocWrapper, Props as HeaderHocProps} from './header-hoc'
import PopupDialog, {Props as PopupDialogProps} from './popup-dialog'

/** TODO deprecate **/
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

export type CloseType = 'onBack' | 'clearModals' | 'none'
type Props = {children: React.ReactNode; closeType?: CloseType; onBack?: () => void}
export const PopupDialogDesktop: (p: Props) => React.ReactElement = Container.isMobile
  ? (props: Props) => props.children as React.ReactElement
  : (props: Props) => {
      const dispatch = Container.useDispatch()
      const onBack = () => dispatch(RouteTreeGen.createNavigateUp())
      const onClearModals = () => dispatch(RouteTreeGen.createClearModals())
      let onClose: undefined | (() => void)

      if (props.onBack) {
        onClose = props.onBack
      } else {
        switch (props.closeType) {
          case 'onBack':
            onClose = onBack
            break
          case 'clearModals':
            onClose = onClearModals
            break
          case 'none':
            onClose = undefined
            break
          default:
            onClose = onBack
        }
      }
      return <PopupDialog onClose={onClose}>{props.children}</PopupDialog>
    }
