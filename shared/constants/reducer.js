// @flow
import type {ConfigState} from '../reducers/config'
import type {FavoriteState} from '../constants/favorite'
import type {State as GregorState} from '../reducers/gregor'
import type {State as SearchState} from '../reducers/search'
import type {State as TotalTrackerState} from '../reducers/tracker'
import type {State as UnlockFoldersState} from '../reducers/unlock-folders'

export type TypedState = {
  unlockFolders: UnlockFoldersState,
  search: SearchState,
  config: ConfigState,
  tracker: TotalTrackerState,
  favorite: FavoriteState,
  gregor: GregorState,
}

// TODO swap State with TypedState when TypedState includes everything we care about
export type State = {[key: string]: any}
export const stateKey = 'reducer:stateKey'
