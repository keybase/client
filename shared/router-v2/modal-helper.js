// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import type {Route} from './routes'
import {compose, connect, isMobile, safeSubmit} from '../util/container'

const dispatchProps = dispatch => ({
  onClosePopup: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const Modal = <P>(C: React.ComponentType<P>) =>
  connect<P, P & {onClosePopup: () => void}, any, any, any>(
    () => ({}),
    dispatchProps,
    (_, dp, op: P) => ({...dp, showCloseButtonPopup: true, ...op})
  )(Kb.PopupDialogHoc(C))

export function modalizeRoutes(route: Route) {
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
