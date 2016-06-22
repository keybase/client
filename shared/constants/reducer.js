/* @flow */

import type {State as UnlockFoldersState} from '../reducers/unlock-folders'
import type {State as SearchState} from '../reducers/search'
import type {ConfigState} from '../reducers/config'

export type TypedState = {
  unlockFolders: UnlockFoldersState,
  search: SearchState,
  config: ConfigState,
}

// TODO swap State with TypedState when TypedState includes everything we care about
export type State = {[key: string]: any}
export const stateKey = 'reducer:stateKey'
