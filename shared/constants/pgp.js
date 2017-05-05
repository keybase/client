// @flow

import type {TypedAction} from './types/flux'

export const pgpKeyInSecretStoreFile = 'pgp:pgpKeyInSecretStoreFile'
export type PgpKeyInSecretStoreFile = TypedAction<'pgp:pgpKeyInSecretStoreFile', void, void>

export const pgpAckedMessage = 'pgp:pgpAckedMessage'
export type PgpAckedMessage = TypedAction<'pgp:pgpAckedMessage', {hitOk: boolean}, {hitOk: boolean}>

export type Actions = PgpKeyInSecretStoreFile | PgpAckedMessage

export type State = {
  open: boolean,
}
