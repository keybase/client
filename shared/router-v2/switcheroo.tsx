// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import * as RouterConstants from '../constants/router2'
import Router from './router'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ConfigConstants from '../constants/config'

const RouterSwitcheroo = React.memo(() => {
  const isDarkMode = Container.useSelector(state => ConfigConstants.isDarkMode(state.config))
  const dispatch = Container.useDispatch()
  const onNavigationStateChange = React.useCallback(
    (prev: any, next: any, action: any) => {
      const pStack = RouterConstants.findVisibleRoute([], prev)
      const nStack = RouterConstants.findVisibleRoute([], next)
      dispatch(
        RouteTreeGen.createOnNavChanged({
          navAction: action,
          next: nStack,
          prev: pStack,
        })
      )
    },
    [dispatch]
  )
  const updateNavigator = React.useCallback(
    navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
    [dispatch]
  )

  return (
    <Router
      updateNavigator={updateNavigator}
      onNavigationStateChange={onNavigationStateChange}
      isDarkMode={isDarkMode}
    />
  )
})

export default RouterSwitcheroo
