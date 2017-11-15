// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/pgp'

// Constants
export const resetStore = 'common:resetStore' // not a part of pgp but is handled by every reducer
export const pgpAckedMessage = 'pgp:pgpAckedMessage'
export const pgpKeyInSecretStoreFile = 'pgp:pgpKeyInSecretStoreFile'

// Action Creators
export const createPgpAckedMessage = (payload: {|+hitOk: boolean|}) => ({error: false, payload, type: pgpAckedMessage})
export const createPgpKeyInSecretStoreFile = () => ({error: false, payload: undefined, type: pgpKeyInSecretStoreFile})

// Action Payloads
export type PgpAckedMessagePayload = More.ReturnType<typeof createPgpAckedMessage>
export type PgpKeyInSecretStoreFilePayload = More.ReturnType<typeof createPgpKeyInSecretStoreFile>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'pgp:pgpAckedMessage': (state: Types.State, action: PgpAckedMessagePayload) => Types.State, 'pgp:pgpKeyInSecretStoreFile': (state: Types.State, action: PgpKeyInSecretStoreFilePayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = PgpAckedMessagePayload | PgpKeyInSecretStoreFilePayload | {type: 'common:resetStore', payload: void}
