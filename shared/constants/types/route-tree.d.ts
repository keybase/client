import type {Actions} from '../../actions/route-tree-gen'
import type {NavigationState} from '@react-navigation/core'
type PathItem = string | {selected: string; payload: Object}
export type Path = Array<PathItem>
type Route = NavigationState['routes'][0]
type NavState = Route['state']

// export type NavState = {
//   key: string
//   name: string
//   params?: any // TODO nicer types
//   state?: {
//     index: number
//     key: string
//     routeNames: Array<string>
//     routes: Array<NavState>
//     type: string
//   }
// }
export type Navigator = {
  getNavState: () => NavState
  dispatchOldAction: (a: Actions) => void
}
