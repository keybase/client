import {Actions} from '../../actions/route-tree-gen'
type PathItem = string | {selected: string; payload: Object}
export type Path = Array<PathItem>
export type NavState = any
export type Navigator = {
  getNavState: () => NavState
  dispatchOldAction: (a: Actions) => void
}
