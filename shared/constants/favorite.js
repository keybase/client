/* @flow */

import type {TypedAction} from '../constants/types/flux'
import type {Props as FolderProps} from '../folders/render'
import type {Folder} from '../constants/types/flow-types'

export const favoriteList = 'favorite:favoriteList'
export type FavoriteList = TypedAction<'favorite:favoriteList', {folders: FolderProps}, void>

export const favoriteIgnore = 'favorite:favoriteIgnore'
export type FavoriteIgnore = TypedAction<'favorite:favoriteIgnore', {folder: Folder}, void>

export type FavoriteAction = FavoriteList | FavoriteIgnore
