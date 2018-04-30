// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'

const makeState: I.RecordFactory<Types._State> = I.Record({
  hello: 'world',
})

export {makeState}
