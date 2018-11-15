// @flow
/* eslint-env jest */
import * as Constants from '../../constants/wallets'
import * as Tabs from '../../constants/tabs'
import * as WalletsGen from '../wallets-gen'
import * as RPCStellarTypes from '../../constants/types/rpc-stellar-gen'
import * as Types from '../../constants/types/wallets'
import * as RouteTree from '../route-tree'
import walletsSaga from '../wallets'
import appRouteTree from '../../app/routes-app'
import * as Testing from '../../util/testing'

jest.mock('../../engine')

const blankStore = Testing.getInitialStore()
const initialStore = {
  ...blankStore,
  wallets: blankStore.wallets.merge({
    accountMap: blankStore.wallets.accountMap.set(
      Types.stringToAccountID('fake account ID'),
      Constants.makeAccount()
    ),
  }),
}

const buildPaymentRpc = {
  amountErrMsg: '',
  banners: null,
  displayAmountFiat: '$5.00 USD',
  displayAmountXLM: '21.4168160 XLM',
  from: 'fake account ID',
  publicMemoErrMsg: '',
  readyToSend: false,
  secretNoteErrMsg: '',
  sendingIntentionXLM: false,
  toErrMsg: '',
  worthAmount: '21.4168160',
  worthCurrency: 'USD',
  worthDescription: '21.4168160 XLM',
  worthInfo: '$1.00 = 4.2833632 XLM\nSource: coinmarketcap.com',
}

const builtPayment = Constants.buildPaymentResultToBuiltPayment(buildPaymentRpc)

const startOnWalletsTab = dispatch => {
  dispatch(RouteTree.switchRouteDef(appRouteTree))
  dispatch(RouteTree.navigateTo([Tabs.walletsTab]))
}

const startReduxSaga = Testing.makeStartReduxSaga(walletsSaga, initialStore, startOnWalletsTab)

describe('build payment', () => {
  it('basic', () => {
    const {dispatch, getState} = startReduxSaga()
    const rpc = jest.spyOn(RPCStellarTypes, 'localBuildPaymentLocalRpcPromise')
    rpc.mockImplementation(() => new Promise(resolve => resolve(buildPaymentRpc)))

    dispatch(WalletsGen.createBuildPayment())
    return Testing.flushPromises().then(() => {
      expect(getState().wallets.builtPayment).toEqual(builtPayment)
      expect(rpc).toHaveBeenCalled()
    })
  })
})

const sendPaymentResult = {
  kbTxID: 'fake transaction id',
  pending: false,
}

describe('send payment', () => {
  it('basic', () => {
    const {dispatch} = startReduxSaga()
    const rpc = jest.spyOn(RPCStellarTypes, 'localSendPaymentLocalRpcPromise')
    rpc.mockImplementation(() => new Promise(resolve => resolve(sendPaymentResult)))

    dispatch(WalletsGen.createSendPayment())
    return Testing.flushPromises().then(() => {
      // TODO: Check building/built/errors are cleared.
      expect(rpc).toHaveBeenCalled()
    })
  })
})
