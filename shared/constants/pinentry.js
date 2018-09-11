// @flow
import * as I from 'immutable'
import * as Types from './types/pinentry'

const makeState: I.RecordFactory<Types._State> = I.Record({
  sessionIDToPinentry: I.Map(),
})

export {makeState}
