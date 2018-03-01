// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import type {RelativePopupHocType, RelativePopupProps} from './relative-popup-hoc'

const RelativePopupHoc: RelativePopupHocType<*> = PopupComponent => {
  const C: React.ComponentType<RelativePopupProps<*>> = connect(
    undefined,
    (dispatch, {navigateUp, routeProps}) => ({
      onClosePopup: () => {
        dispatch(navigateUp())
        const onPopupWillClose = routeProps.get('onPopupWillClose')
        onPopupWillClose && onPopupWillClose()
      },
      position: routeProps.get('position'),
      targetRect: routeProps.get('targetRect'),
    })
  )((props: RelativePopupProps<*> & {onClosePopup: () => void}) => {
    return <PopupComponent {...(props: RelativePopupProps<*>)} onClosePopup={props.onClosePopup} />
  })

  return C
}

export default RelativePopupHoc
