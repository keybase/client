import * as I from 'immutable'
import * as Types from './types/pinentry'

const makeState: I.Record.Factory<Types._State> = I.Record({
  sessionIDToPinentry: I.Map(),
})

export {makeState}
