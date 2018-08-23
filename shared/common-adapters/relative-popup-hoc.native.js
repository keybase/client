// @flow
import * as React from 'react'
import {connect} from '../util/container'
import type {RelativePopupHocType, Props} from './relative-popup-hoc.types'

const RelativePopupHoc: RelativePopupHocType<any> = PopupComponent => {
  const C: React.ComponentType<Props<any>> = connect(
    () => ({}),
    (dispatch, {navigateUp, routeProps}) => ({
      onClosePopup: () => {
        dispatch(navigateUp())
        const onPopupWillClose = routeProps.get('onPopupWillClose')
        onPopupWillClose && onPopupWillClose()
      },
      position: routeProps.get('position'),
      targetRect: routeProps.get('targetRect'),
    }),
    (s, d, o) => ({...o, ...s, ...d})
  )((props: Props<any> & {onClosePopup: () => void}) => {
    // $FlowIssue
    return <PopupComponent {...(props: Props<any>)} onClosePopup={props.onClosePopup} />
  })

  return C
}

export default RelativePopupHoc
