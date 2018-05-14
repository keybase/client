// @flow
import * as React from 'react'
import {connect, type Dispatch} from '../util/container'
import type {RelativePopupHocType, RelativePopupProps} from './relative-popup-hoc'

const RelativePopupHoc: RelativePopupHocType<any> = PopupComponent => {
  const C: React.ComponentType<RelativePopupProps<any>> = connect(
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
  )((props: RelativePopupProps<any> & {onClosePopup: () => void}) => {
    // $FlowIssue
    return <PopupComponent {...(props: RelativePopupProps<any>)} onClosePopup={props.onClosePopup} />
  })

  return C
}

export default RelativePopupHoc
