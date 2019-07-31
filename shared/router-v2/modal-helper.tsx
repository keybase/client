import * as React from 'react'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {connect, isMobile, Route} from '../util/container'
import {HocExtractProps} from '../common-adapters/popup-dialog-hoc'

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
    () => ({}),
    dispatchProps,
    (_, dp, op: P) => ({...dp, ...op})
    // @ts-ignore TODO figure out this types
  )(withPopup)
}

export function modalizeRoute<T extends Route>(route: T) {
  if (isMobile) {
    return route
  }

  let toMerge = {}
  if (route.screen) {
    toMerge = {screen: Modal(route.screen)}
  } else if (route.getScreen) {
    let _cached: unknown = null
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
