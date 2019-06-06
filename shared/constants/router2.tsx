let _navigator = null
// Private API only used by config sagas
export const _setNavigator = (navigator: any) => {
  _navigator = navigator
  if (__DEV__) {
    if (require('./platform').isMobile) {
      global.DEBUGNavigator = _navigator
    } else {
      // @ts-ignore
      window.DEBUGNavigator = _navigator
    }
  }
}
export const _getNavigator = () => {
  return _navigator
}
// Private API only used by config sagas

const findVisibleRoute = (arr, s) => {
  if (!s) return arr
  if (!s.routes) return s
  const route = s.routes[s.index]
  if (!route) return arr
  if (route.routes) return findVisibleRoute([...arr, route], route)
  return [...arr, route]
}

const findModalRoute = (arr, s) => {
  const loggedInOut = s.routes[s.index]
  // only logged in has modals
  if (!loggedInOut || loggedInOut.routeName !== 'loggedIn') {
    return []
  }

  return loggedInOut.routes.slice(1)
}

// this returns the full path as seen from a stack. So if you pop you'll go up
// this path stack
// TODO this depends on our specific nav setup, check for it somehow
const _getStackPathHelper = (arr, s: any) => {
  if (!s) return arr
  if (!s.routes) return arr
  const route = s.routes[s.index]
  if (!route) return arr
  if (route.routes) return _getStackPathHelper([...arr, s.routes[s.index]], route)
  if (s.routeName === 'loggedIn' && s.index !== 0) {
    // Modal stack is selected, make sure we get app routes too
    // modals are at indices >= 1
    return [...arr, ..._getStackPathHelper([], s.routes[0]), ...s.routes.slice(1)]
  }
  // leaf router - this is a stack router within a tab
  // start slice at 0 to also get the pages stacked below the current one
  return [...arr, ...s.routes.slice(0, s.index + 1)]
}

const findFullRoute = s => {
  const loggedInOut = s.routes[s.index]
  if (loggedInOut.routeName === 'loggedIn') {
    return _getStackPathHelper([], s)
  }
  return loggedInOut.routes
}
// Private API used by navigator itself
export const _getVisiblePathForNavigator = (navState: any) => {
  if (!navState) return []
  return findVisibleRoute([], navState)
}

export const _getModalStackForNavigator = (navState: any) => {
  if (!navState) return []
  return findModalRoute([], navState)
}

export const _getFullRouteForNavigator = (navState: any) => {
  if (!navState) return []
  return findFullRoute(navState)
}

// Public API
export const getVisiblePath = () => {
  if (!_navigator) return []
  return findVisibleRoute([], _navigator.getNavState())
}

export const getModalStack = () => {
  if (!_navigator) return []
  return findModalRoute([], _navigator.getNavState())
}

export const getVisibleScreen = () => {
  const visible = getVisiblePath()
  return visible[visible.length - 1]
}

export const getFullRoute = () => {
  if (!_navigator) return []
  return findFullRoute(_navigator.getNavState())
}
