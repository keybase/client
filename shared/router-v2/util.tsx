import {NavState} from '../constants/types/route-tree'
// We could have subnavigators, so traverse the routes so we can get the active
// screen's index so we know when to enable the back button. Note this doesn't
// support a subnavigator with a root you can hit back from.
export const getActiveIndex = (navState: NavState): number => {
  if (!navState.routes) {
    return navState.index
  }
  const route = navState.routes[navState.index]
  if (route.routes) {
    return getActiveIndex(route)
  }
  return navState.index
}
// Get active key inside any subnavigator so navigation closures are
export const getActiveKey = (navState: NavState): string => {
  if (!navState.routes) {
    return navState.key
  }
  const route = navState.routes[navState.index]
  if (route.routes) {
    return getActiveKey(route)
  }
  return navState.routes[navState.index].key
}
