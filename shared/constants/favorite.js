/* @flow */

import type {TypedAction} from '../constants/types/flux'
import type {$Exact} from '../constants/types/more'
import type {Folder} from '../constants/folders'

type ListState = $Exact<{
  tlfs?: Array<Folder>,
  ignored?: Array<Folder>,
  isPublic: boolean,
  style?: any,
  smallMode?: boolean,
  onClick?: (path: string) => void,
  onRekey?: (path: string) => void,
  onOpen?: (path: string) => void,
  extraRows?: Array<React$Element>
}>

export type State = $Exact<{
  privateBadge: number,
  private: ListState,
  publicBadge: number,
  public: ListState,
}>

export const favoriteAdd = 'favorite:favoriteAdd'
export type FavoriteAdd = TypedAction<'favorite:favoriteAdd', void, {errorText: string}>

export const favoriteList = 'favorite:favoriteList'
export type FavoriteList = TypedAction<'favorite:favoriteList', {folders: State}, void>

export const favoriteIgnore = 'favorite:favoriteIgnore'
export type FavoriteIgnore = TypedAction<'favorite:favoriteIgnore', void, {errorText: string}>

export type FavoriteAction = FavoriteAdd | FavoriteList | FavoriteIgnore
