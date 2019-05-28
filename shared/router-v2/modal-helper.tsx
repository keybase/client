import * as React from 'react'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {Route} from './routes'
import {connect, isMobile} from '../util/container'

const dispatchProps = dispatch => ({
  onClosePopup: () => dispatch(RouteTreeGen.createNavigateUp()),
})

function Modal<P>(
  C: React.ComponentType<P> // eslint-disable-next-line func-call-spacing
) {
  return connect(
    () => ({}),
    dispatchProps,
    (_, dp, op: P) => ({...dp, ...op})
  )(Kb.PopupDialogHoc(C))
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
