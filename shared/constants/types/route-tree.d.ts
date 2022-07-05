import {NavigationRoute} from 'react-navigation'
import {Actions} from '../../actions/route-tree-gen'
type PathItem = string | {selected: string; payload: Object}
export type Path = Array<PathItem>
export type NavState = NavigationRoute
export type Navigator = {
  getNavState: () => NavState
  dispatchOldAction: (a: Actions) => void
}
