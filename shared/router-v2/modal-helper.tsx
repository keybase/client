import * as React from 'react'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {Route} from './routes'
import {connect, isMobile} from '../util/container'
import {WithoutPopupProps, HocExtractProps} from '../common-adapters/popup-dialog-hoc'
import {InferableComponentEnhancerWithProps, Matching} from 'react-redux'

const dispatchProps = dispatch => ({
  onClosePopup: () => {
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

function Modal<P extends {}>(
  C: React.ComponentType<Omit<P, keyof HocExtractProps>> // eslint-disable-next-line func-call-spacing
) {
  const withPopup = Kb.PopupDialogHoc(C)
  return connect(
    (_, op: P) => ({}),
    dispatchProps,
    (_, dp, op: P) => ({...dp, ...op})
    // @ts-ignore TODO figure out this types
  )(withPopup)
}

export function modalizeRoute(route: Route) {
  if (isMobile) {
    return route
  }

  let toMerge = {}
  if (route.screen) {
    toMerge = {screen: Modal(route.screen)}
  } else if (route.getScreen) {
    let _cached = null
    toMerge = {
      getScreen: () => {
        if (_cached) {
          return _cached
        }
        const S = route.getScreen()
        _cached = Modal(S)
        return _cached
      },
    }
  }

  return {
    ...route,
    ...toMerge,
  }
}
