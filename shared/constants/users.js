// @flow
import * as I from 'immutable'
import * as Types from './types/users'

export const makeUserInfo: I.RecordFactory<Types._UserInfo> = I.Record({
  broken: false,
  fullname: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  infoMap: I.Map(),
})
