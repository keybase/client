// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'

const makeAsset: I.RecordFactory<Types._Asset> = I.Record({
  balance: '',
  code: '',
  domain: '',
  issuer: '',
})

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  hello: 'world',
})

export {makeAsset, makeReserve, makeState}
