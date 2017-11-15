// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/favorite'
import * as Folders from '../constants/folders'

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
export const kbfsStatusUpdated = 'favorite:kbfsStatusUpdated'
export const markTLFCreated = 'favorite:markTLFCreated'
export const setupKBFSChangedHandler = 'favorite:setupKBFSChangedHandler'

// Action Creators
export const createFavoriteAdd = (payload: {|+path: string|}) => ({error: false, payload, type: favoriteAdd})
export const createFavoriteAdded = () => ({error: false, payload: undefined, type: favoriteAdded})
export const createFavoriteAddedError = (payload: {|+errorText: string|}) => ({error: true, payload, type: favoriteAdded})
export const createFavoriteIgnore = (payload: {|+path: string|}) => ({error: false, payload, type: favoriteIgnore})
export const createFavoriteIgnored = () => ({error: false, payload: undefined, type: favoriteIgnored})
export const createFavoriteIgnoredError = (payload: {|+errorText: string|}) => ({error: true, payload, type: favoriteIgnored})
export const createFavoriteList = () => ({error: false, payload: undefined, type: favoriteList})
export const createFavoriteListed = (payload: {|+folders: Types.FolderState|}) => ({error: false, payload, type: favoriteListed})
export const createFavoriteSwitchTab = (payload: {|+showingPrivate: boolean|}) => ({error: false, payload, type: favoriteSwitchTab})
export const createFavoriteToggleIgnored = (payload: {|+isPrivate: boolean|}) => ({error: false, payload, type: favoriteToggleIgnored})
export const createKbfsStatusUpdated = (payload: {|+status: Types.KBFSStatus|}) => ({error: false, payload, type: kbfsStatusUpdated})
export const createMarkTLFCreated = (payload: {|+folder: Folders.Folder|}) => ({error: false, payload, type: markTLFCreated})
export const createSetupKBFSChangedHandler = () => ({error: false, payload: undefined, type: setupKBFSChangedHandler})

// Action Payloads
export type FavoriteAddPayload = More.ReturnType<typeof createFavoriteAdd>
export type FavoriteAddedPayload = More.ReturnType<typeof createFavoriteAdded>
export type FavoriteAddedErrorPayload = More.ReturnType<typeof createFavoriteAddedError>
export type FavoriteIgnorePayload = More.ReturnType<typeof createFavoriteIgnore>
export type FavoriteIgnoredPayload = More.ReturnType<typeof createFavoriteIgnored>
export type FavoriteIgnoredErrorPayload = More.ReturnType<typeof createFavoriteIgnoredError>
export type FavoriteListPayload = More.ReturnType<typeof createFavoriteList>
export type FavoriteListedPayload = More.ReturnType<typeof createFavoriteListed>
export type FavoriteSwitchTabPayload = More.ReturnType<typeof createFavoriteSwitchTab>
export type FavoriteToggleIgnoredPayload = More.ReturnType<typeof createFavoriteToggleIgnored>
export type KbfsStatusUpdatedPayload = More.ReturnType<typeof createKbfsStatusUpdated>
export type MarkTLFCreatedPayload = More.ReturnType<typeof createMarkTLFCreated>
export type SetupKBFSChangedHandlerPayload = More.ReturnType<typeof createSetupKBFSChangedHandler>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'favorite:favoriteAdd': (state: Types.State, action: FavoriteAddPayload) => Types.State, 'favorite:favoriteAdded': (state: Types.State, action: FavoriteAddedPayload|FavoriteAddedErrorPayload) => Types.State, 'favorite:favoriteIgnore': (state: Types.State, action: FavoriteIgnorePayload) => Types.State, 'favorite:favoriteIgnored': (state: Types.State, action: FavoriteIgnoredPayload|FavoriteIgnoredErrorPayload) => Types.State, 'favorite:favoriteList': (state: Types.State, action: FavoriteListPayload) => Types.State, 'favorite:favoriteListed': (state: Types.State, action: FavoriteListedPayload) => Types.State, 'favorite:favoriteSwitchTab': (state: Types.State, action: FavoriteSwitchTabPayload) => Types.State, 'favorite:favoriteToggleIgnored': (state: Types.State, action: FavoriteToggleIgnoredPayload) => Types.State, 'favorite:kbfsStatusUpdated': (state: Types.State, action: KbfsStatusUpdatedPayload) => Types.State, 'favorite:markTLFCreated': (state: Types.State, action: MarkTLFCreatedPayload) => Types.State, 'favorite:setupKBFSChangedHandler': (state: Types.State, action: SetupKBFSChangedHandlerPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = FavoriteAddPayload | FavoriteAddedPayload
 | FavoriteAddedErrorPayload | FavoriteIgnorePayload | FavoriteIgnoredPayload
 | FavoriteIgnoredErrorPayload | FavoriteListPayload | FavoriteListedPayload | FavoriteSwitchTabPayload | FavoriteToggleIgnoredPayload | KbfsStatusUpdatedPayload | MarkTLFCreatedPayload | SetupKBFSChangedHandlerPayload | {type: 'common:resetStore', payload: void}
