/* @flow */

import type {State as UnlockFoldersState} from '../reducers/unlock-folders'

export type TypedState = {unlockFolders: UnlockFoldersState}

// TODO swap State with TypedState when TypedState includes everything we care about
export type State = {[key: string]: any}
export const stateKey = 'reducer:stateKey'
