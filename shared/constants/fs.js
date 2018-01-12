// @flow
import * as I from 'immutable'
import * as Types from './types/fs'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  counter: 0,
})
