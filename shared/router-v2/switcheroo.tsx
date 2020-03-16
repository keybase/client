// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import * as RouterConstants from '../constants/router2'
import Router from './router'
import * as Container from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ConfigConstants from '../constants/config'
import debounce from 'lodash/debounce'

const RouterSwitcheroo = React.memo(() => {
  const isDarkMode = Container.useSelector(state => ConfigConstants.isDarkMode(state.config))
  const dispatch = Container.useDispatch()
  const persistRoute = React.useCallback(
    debounce(() => {
      // debounce this so we don't persist a route that can crash and then keep them in some crash loop
      const path = RouterConstants.getVisiblePath()
      dispatch(ConfigGen.createPersistRoute({path}))
    }, 1000),
    [dispatch]
  )

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
    [dispatch, persistRoute]
  )
  const updateNavigator = React.useCallback(
    navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
    [dispatch]
  )

  return (
    <Router ref={updateNavigator} onNavigationStateChange={onNavigationStateChange} isDarkMode={isDarkMode} />
  )
})

export default RouterSwitcheroo
