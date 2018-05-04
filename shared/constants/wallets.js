// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  hello: 'world',
})

export {makeReserve, makeState}
