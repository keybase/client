import * as I from 'immutable'
import * as Types from './types/pinentry'

const makeState = I.Record<Types._State>({
  sessionIDToPinentry: I.Map(),
})

export {makeState}
