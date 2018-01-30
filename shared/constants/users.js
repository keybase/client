// @flow
import * as I from 'immutable'
import * as Types from './types/users'

export const makeUserInfo: I.RecordFactory<Types._UserInfo> = I.Record({
  broken: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  users: I.Map(),
})
