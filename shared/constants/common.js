/* @flow */

import type {TypedAction} from '../constants/types/flux'

export const resetStore = 'common:resetStore'
export type ResetStore = TypedAction< 'common:resetStore', void, void>
