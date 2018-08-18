// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/favorite'
import * as Folders from '../constants/types/folders'

// Constants
export const resetStore = 'common:resetStore' // not a part of favorite but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'favorite:'
export const favoriteAdd = 'favorite:favoriteAdd'
export const favoriteAdded = 'favorite:favoriteAdded'
export const favoriteIgnore = 'favorite:favoriteIgnore'
export const favoriteIgnored = 'favorite:favoriteIgnored'
export const favoriteList = 'favorite:favoriteList'
export const favoriteListed = 'favorite:favoriteListed'
export const favoriteSwitchTab = 'favorite:favoriteSwitchTab'
export const favoriteToggleIgnored = 'favorite:favoriteToggleIgnored'
export const markTLFCreated = 'favorite:markTLFCreated'

// Payload Types
type _FavoriteAddPayload = $ReadOnly<{|path: string|}>
type _FavoriteAddedPayload = void
type _FavoriteAddedPayloadError = $ReadOnly<{|errorText: string|}>
type _FavoriteIgnorePayload = $ReadOnly<{|path: string|}>
type _FavoriteIgnoredPayload = void
type _FavoriteIgnoredPayloadError = $ReadOnly<{|errorText: string|}>
type _FavoriteListPayload = void
type _FavoriteListedPayload = $ReadOnly<{|folders: Types.FolderState|}>
type _FavoriteSwitchTabPayload = $ReadOnly<{|showingPrivate: boolean|}>
type _FavoriteToggleIgnoredPayload = $ReadOnly<{|isPrivate: boolean|}>
type _MarkTLFCreatedPayload = $ReadOnly<{|folder: Folders.Folder|}>

// Action Creators
export const createFavoriteAdd = (payload: _FavoriteAddPayload) => ({error: false, payload, type: favoriteAdd})
export const createFavoriteAdded = (payload: _FavoriteAddedPayload) => ({error: false, payload, type: favoriteAdded})
export const createFavoriteAddedError = (payload: _FavoriteAddedPayloadError) => ({error: true, payload, type: favoriteAdded})
export const createFavoriteIgnore = (payload: _FavoriteIgnorePayload) => ({error: false, payload, type: favoriteIgnore})
export const createFavoriteIgnored = (payload: _FavoriteIgnoredPayload) => ({error: false, payload, type: favoriteIgnored})
export const createFavoriteIgnoredError = (payload: _FavoriteIgnoredPayloadError) => ({error: true, payload, type: favoriteIgnored})
export const createFavoriteList = (payload: _FavoriteListPayload) => ({error: false, payload, type: favoriteList})
export const createFavoriteListed = (payload: _FavoriteListedPayload) => ({error: false, payload, type: favoriteListed})
export const createFavoriteSwitchTab = (payload: _FavoriteSwitchTabPayload) => ({error: false, payload, type: favoriteSwitchTab})
export const createFavoriteToggleIgnored = (payload: _FavoriteToggleIgnoredPayload) => ({error: false, payload, type: favoriteToggleIgnored})
export const createMarkTLFCreated = (payload: _MarkTLFCreatedPayload) => ({error: false, payload, type: markTLFCreated})

// Action Payloads
export type FavoriteAddPayload = $Call<typeof createFavoriteAdd, _FavoriteAddPayload>
export type FavoriteAddedPayload = $Call<typeof createFavoriteAdded, _FavoriteAddedPayload>
export type FavoriteAddedPayloadError = $Call<typeof createFavoriteAddedError, _FavoriteAddedPayloadError>
export type FavoriteIgnorePayload = $Call<typeof createFavoriteIgnore, _FavoriteIgnorePayload>
export type FavoriteIgnoredPayload = $Call<typeof createFavoriteIgnored, _FavoriteIgnoredPayload>
export type FavoriteIgnoredPayloadError = $Call<typeof createFavoriteIgnoredError, _FavoriteIgnoredPayloadError>
export type FavoriteListPayload = $Call<typeof createFavoriteList, _FavoriteListPayload>
export type FavoriteListedPayload = $Call<typeof createFavoriteListed, _FavoriteListedPayload>
export type FavoriteSwitchTabPayload = $Call<typeof createFavoriteSwitchTab, _FavoriteSwitchTabPayload>
export type FavoriteToggleIgnoredPayload = $Call<typeof createFavoriteToggleIgnored, _FavoriteToggleIgnoredPayload>
export type MarkTLFCreatedPayload = $Call<typeof createMarkTLFCreated, _MarkTLFCreatedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | FavoriteAddPayload
  | FavoriteAddedPayload
  | FavoriteAddedPayloadError
  | FavoriteIgnorePayload
  | FavoriteIgnoredPayload
  | FavoriteIgnoredPayloadError
  | FavoriteListPayload
  | FavoriteListedPayload
  | FavoriteSwitchTabPayload
  | FavoriteToggleIgnoredPayload
  | MarkTLFCreatedPayload
  | {type: 'common:resetStore', payload: void}
