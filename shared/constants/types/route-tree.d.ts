import {NavigationRoute} from 'react-navigation'
type PathItem = string | {selected: string; payload: Object}
export type Path = Array<PathItem>
export type NavState = NavigationRoute
export type Navigator = {
  getNavState: () => NavState
}
