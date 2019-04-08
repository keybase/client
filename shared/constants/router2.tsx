let _navigator = null
// Private API only used by config sagas
export const _setNavigator = (navigator: any) => {
  _navigator = navigator
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

// Private API used by navigator itself
export const _getVisiblePathForNavigator = (navState: any) => {
  if (!_navigator) return []
  return findVisibleRoute([], navState)
}

// Public API
export const getVisiblePath = () => {
  if (!_navigator) return []
  return findVisibleRoute([], _navigator.getNavState())
}
