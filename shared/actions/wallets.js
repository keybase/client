// @flow
import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as RPCTypes from '../constants/types/rpc-stellar-gen'
import * as Saga from '../util/saga'
import * as WalletsGen from './wallets-gen'
import * as WaitingGen from './waiting-gen'
import {RPCError} from '../util/errors'

const loadAccounts = (action: WalletsGen.LoadAccountsPayload) =>
  Saga.call(RPCTypes.localGetWalletAccountsLocalRpcPromise)

const loadAccountsSuccess = (res: ?Array<Types.Account>) =>
  Saga.put(
    WalletsGen.createAccountsReceived({
      accounts: (res || []).map(account => Constants.accountResultToAccount(account)),
    })
  )

const loadAssets = (action: WalletsGen.LoadAssetsPayload) =>
  Saga.call(RPCTypes.localGetAccountAssetsLocalRpcPromise, {accountID: action.payload.accountID})

const loadAssetsSuccess = (res: any, action: WalletsGen.LoadAssetsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createAssetsReceived({
      accountID,
      assets: (res || []).map(assets => Constants.assetsResultToAssets(assets)),
    })
  )
}

const loadPayments = (action: WalletsGen.LoadPaymentsPayload) =>
  Saga.call(RPCTypes.localGetPaymentsLocalRpcPromise, {accountID: action.payload.accountID})

const loadPaymentsSuccess = (res: any, action: WalletsGen.LoadPaymentsPayload) => {
  const {accountID} = action.payload
  return Saga.put(
    WalletsGen.createPaymentsReceived({
      accountID,
      payments: res.payments.map(elem => Constants.paymentResultToPayment(elem)),
    })
  )
}

const linkExistingAccount = (action: WalletsGen.LinkExistingAccountPayload) => {
  const {name, secretKey} = action.payload
  return Saga.call(RPCTypes.localLinkNewWalletAccountLocalRpcPromise, {
    name,
    secretKey: secretKey.stringValue(),
  })
}

const validateAccountName = (action: WalletsGen.ValidateAccountNamePayload) => {
  if (action.error) {
    return
  }
  const {name, waitingKey} = action.payload
  const actions = [Saga.call(RPCTypes.localValidateAccountNameLocalRpcPromise, {name})]
  if (waitingKey) {
    actions.unshift(Saga.put(WaitingGen.createIncrementWaiting({key: waitingKey})))
    actions.push(Saga.put(WaitingGen.createDecrementWaiting({key: waitingKey})))
  }
  return Saga.sequentially(actions)
}
const validateAccountNameError = (err: RPCError, {payload: {name}}: WalletsGen.ValidateAccountNamePayload) =>
  Saga.put(WalletsGen.createValidateAccountNameError({error: err.desc, name}))

const validateSecretKey = (action: WalletsGen.ValidateSecretKeyPayload) => {
  if (action.error) {
    return
  }
  const {secretKey, waitingKey} = action.payload
  const actions = [
    Saga.call(RPCTypes.localValidateSecretKeyLocalRpcPromise, {secretKey: secretKey.stringValue()}),
  ]
  if (waitingKey) {
    actions.unshift(Saga.put(WaitingGen.createIncrementWaiting({key: waitingKey})))
    actions.push(Saga.put(WaitingGen.createDecrementWaiting({key: waitingKey})))
  }
  return Saga.sequentially(actions)
}
const validateSecretKeyError = (err: RPCError, {payload: {secretKey}}: WalletsGen.ValidateSecretKeyPayload) =>
  Saga.put(WalletsGen.createValidateSecretKeyError({error: err.desc, secretKey}))

function* walletsSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(WalletsGen.loadAccounts, loadAccounts, loadAccountsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadAssets, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.loadPayments, loadPayments, loadPaymentsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, loadAssets, loadAssetsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.selectAccount, loadPayments, loadPaymentsSuccess)
  yield Saga.safeTakeEveryPure(WalletsGen.linkExistingAccount, linkExistingAccount)
  yield Saga.safeTakeEveryPure(
    WalletsGen.validateAccountName,
    validateAccountName,
    undefined,
    validateAccountNameError
  )
  yield Saga.safeTakeEveryPure(
    WalletsGen.validateSecretKey,
    validateSecretKey,
    undefined,
    validateSecretKeyError
  )
}

export default walletsSaga
