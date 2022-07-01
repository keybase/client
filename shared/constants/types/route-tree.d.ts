import type {Actions} from '../../actions/route-tree-gen'
import type {NavigationState} from '@react-navigation/core'
type PathItem = string | {selected: string; payload: Object}
export type Path = Array<PathItem>
export type Route = NavigationState['routes'][0]
export type NavState = Route['state']
export type Navigator = {
  getNavState: () => NavState
  dispatchOldAction: (a: Actions) => void
}
