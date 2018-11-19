// @flow
import * as I from 'immutable'
import * as Types from './types/users'
import {type TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string): ?string =>
  state.users.infoMap.getIn([username, 'fullname'], null)

export const getIsBroken = (infoMap: Types.InfoMap, username: string) =>
  infoMap.getIn([username, 'broken'], null)

export const makeUserInfo: I.RecordFactory<Types._UserInfo> = I.Record({
  broken: false,
  fullname: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  infoMap: I.Map(),
})
