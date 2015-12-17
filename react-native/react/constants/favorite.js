/* @flow */

import type {TypedAction} from '../constants/types/flux'
import type {Folder} from '../constants/types/flow-types'

export const favoriteList = 'favorite:favoriteList'
export type FavoriteList = TypedAction<'favorite:favoriteList', {folders: Array<Folder>}, void>

export type FavoriteAction = FavoriteList

