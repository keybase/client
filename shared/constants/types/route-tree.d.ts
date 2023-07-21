import type {NavigationState} from '@react-navigation/core'
import type {NavigateAppendType} from '../../router-v2/route-params'
export type PathParam = NavigateAppendType
export type Route = NavigationState['routes'][0]
export type NavState = Route['state']
export type Navigator = {
  getNavState: () => NavState
}
