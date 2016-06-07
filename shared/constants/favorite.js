/* @flow */

import type {TypedAction} from '../constants/types/flux'
import type {Props as FolderProps} from '../folders/render'

export const favoriteList = 'favorite:favoriteList'
export type FavoriteList = TypedAction<'favorite:favoriteList', {folders: FolderProps}, void>

export type FavoriteAction = FavoriteList
