// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/favorite'
import * as Folders from '../constants/types/folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of favorite but is handled by every reducer
export const favoriteAdd = 'favorite:favoriteAdd'
export const favoriteAdded = 'favorite:favoriteAdded'
export const favoriteIgnore = 'favorite:favoriteIgnore'
export const favoriteIgnored = 'favorite:favoriteIgnored'
export const favoriteList = 'favorite:favoriteList'
export const favoriteListed = 'favorite:favoriteListed'
export const favoriteSwitchTab = 'favorite:favoriteSwitchTab'
export const favoriteToggleIgnored = 'favorite:favoriteToggleIgnored'
export const markTLFCreated = 'favorite:markTLFCreated'

// Action Creators
export const createFavoriteAdd = (payload: $ReadOnly<{|path: string|}>) => ({error: false, payload, type: favoriteAdd})
export const createFavoriteAdded = () => ({error: false, payload: undefined, type: favoriteAdded})
export const createFavoriteAddedError = (payload: $ReadOnly<{|errorText: string|}>) => ({error: true, payload, type: favoriteAdded})
export const createFavoriteIgnore = (payload: $ReadOnly<{|path: string|}>) => ({error: false, payload, type: favoriteIgnore})
export const createFavoriteIgnored = () => ({error: false, payload: undefined, type: favoriteIgnored})
export const createFavoriteIgnoredError = (payload: $ReadOnly<{|errorText: string|}>) => ({error: true, payload, type: favoriteIgnored})
export const createFavoriteList = () => ({error: false, payload: undefined, type: favoriteList})
export const createFavoriteListed = (payload: $ReadOnly<{|folders: Types.FolderState|}>) => ({error: false, payload, type: favoriteListed})
export const createFavoriteSwitchTab = (payload: $ReadOnly<{|showingPrivate: boolean|}>) => ({error: false, payload, type: favoriteSwitchTab})
export const createFavoriteToggleIgnored = (payload: $ReadOnly<{|isPrivate: boolean|}>) => ({error: false, payload, type: favoriteToggleIgnored})
export const createMarkTLFCreated = (payload: $ReadOnly<{|folder: Folders.Folder|}>) => ({error: false, payload, type: markTLFCreated})

// Action Payloads
export type FavoriteAddPayload = More.ReturnType<typeof createFavoriteAdd>
export type FavoriteAddedPayload = More.ReturnType<typeof createFavoriteAdded>
export type FavoriteIgnorePayload = More.ReturnType<typeof createFavoriteIgnore>
export type FavoriteIgnoredPayload = More.ReturnType<typeof createFavoriteIgnored>
export type FavoriteListPayload = More.ReturnType<typeof createFavoriteList>
export type FavoriteListedPayload = More.ReturnType<typeof createFavoriteListed>
export type FavoriteSwitchTabPayload = More.ReturnType<typeof createFavoriteSwitchTab>
export type FavoriteToggleIgnoredPayload = More.ReturnType<typeof createFavoriteToggleIgnored>
export type MarkTLFCreatedPayload = More.ReturnType<typeof createMarkTLFCreated>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createFavoriteAdd>
  | More.ReturnType<typeof createFavoriteAdded>
  | More.ReturnType<typeof createFavoriteAddedError>
  | More.ReturnType<typeof createFavoriteIgnore>
  | More.ReturnType<typeof createFavoriteIgnored>
  | More.ReturnType<typeof createFavoriteIgnoredError>
  | More.ReturnType<typeof createFavoriteList>
  | More.ReturnType<typeof createFavoriteListed>
  | More.ReturnType<typeof createFavoriteSwitchTab>
  | More.ReturnType<typeof createFavoriteToggleIgnored>
  | More.ReturnType<typeof createMarkTLFCreated>
  | {type: 'common:resetStore', payload: void}
