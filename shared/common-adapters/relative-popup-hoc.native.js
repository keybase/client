// @flow
import * as React from 'react'
import {connect, type Dispatch} from '../util/container'
import type {RelativePopupHocType, RelativePopupProps} from './relative-popup-hoc'

const RelativePopupHoc: RelativePopupHocType<*> = PopupComponent => {
  const C: React.ComponentType<RelativePopupProps<*>> = connect(
    undefined,
    (dispatch: Dispatch, {navigateUp, routeProps}) => ({
      onClosePopup: () => {
        dispatch(navigateUp())
        const onPopupWillClose = routeProps.get('onPopupWillClose')
        onPopupWillClose && onPopupWillClose()
      },
      position: routeProps.get('position'),
      targetRect: routeProps.get('targetRect'),
    })
  )((props: RelativePopupProps<*> & {onClosePopup: () => void}) => {
    // $FlowIssue
    return <PopupComponent {...(props: RelativePopupProps<*>)} onClosePopup={props.onClosePopup} />
  })

  return C
}

export default RelativePopupHoc
