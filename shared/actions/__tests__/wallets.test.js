// @flow
/* eslint-env jest */
import * as I from 'immutable'
import * as Constants from '../../constants/wallets'
import * as Tabs from '../../constants/tabs'
import * as WalletsGen from '../wallets-gen'
import * as RPCStellarTypes from '../../constants/types/rpc-stellar-gen'
import * as Types from '../../constants/types/wallets'
import * as RouteTree from '../route-tree'
import walletsSaga from '../wallets'
import appRouteTree from '../../app/routes-app'
import * as Testing from '../../util/testing'
import {getPath as getRoutePath} from '../../route-tree'

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

const startOnWalletsTab = dispatch => {
  dispatch(RouteTree.switchRouteDef(appRouteTree))
  dispatch(RouteTree.navigateTo([Tabs.walletsTab]))
}

const startReduxSaga = Testing.makeStartReduxSaga(walletsSaga, initialStore, startOnWalletsTab)

const getRoute = getState => getRoutePath(getState().routeTree.routeState, [Tabs.walletsTab])

const buildPaymentRes: RPCStellarTypes.BuildPaymentResLocal = {
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

it('disclaimer', () => {
  const {dispatch, getState} = startReduxSaga()

  const assertRedirectToDisclaimer = () => {
    dispatch(WalletsGen.createOpenSendRequestForm({to: 'fake recipient'}))
    expect(getState().wallets.building.to).toEqual('')
    expect(getRoute(getState)).toEqual(I.List([Tabs.walletsTab, 'wallet']))
  }

  // Not yet accepted disclaimer.
  assertRedirectToDisclaimer()

  const checkRPC = jest.spyOn(RPCStellarTypes, 'localHasAcceptedDisclaimerLocalRpcPromise')
  checkRPC.mockImplementation(() => new Promise(resolve => resolve(false)))

  dispatch(WalletsGen.createLoadWalletDisclaimer())
  return Testing.flushPromises()
    .then(() => {
      expect(getState().wallets.acceptedDisclaimer).toEqual(false)
      expect(checkRPC).toHaveBeenCalled()

      // Still haven't accepted disclaimer.
      assertRedirectToDisclaimer()

      dispatch(WalletsGen.createRejectDisclaimer())

      // Still haven't accepted disclaimer.
      assertRedirectToDisclaimer()

      const acceptRPC = jest.spyOn(RPCStellarTypes, 'localAcceptDisclaimerLocalRpcPromise')
      acceptRPC.mockImplementation(() => new Promise(resolve => resolve()))

      const checkRPC2 = jest.spyOn(RPCStellarTypes, 'localHasAcceptedDisclaimerLocalRpcPromise')
      checkRPC2.mockImplementation(() => new Promise(resolve => resolve(true)))

      dispatch(WalletsGen.createAcceptDisclaimer({nextScreen: 'openWallet'}))
      return Testing.flushPromises({acceptRPC, checkRPC2})
    })
    .then(({acceptRPC, checkRPC2}) => {
      expect(getState().wallets.acceptedDisclaimer).toEqual(true)
      expect(acceptRPC).toHaveBeenCalled()
      expect(checkRPC2).toHaveBeenCalled()

      const getCurrencyRPC = jest.spyOn(RPCStellarTypes, 'localGetDisplayCurrencyLocalRpcPromise')
      const currencyLocal: RPCStellarTypes.CurrencyLocal = {
        description: 'fake description',
        code: 'fake code',
        symbol: 'fake symbol',
        name: 'fake name',
      }
      getCurrencyRPC.mockImplementation(() => new Promise(resolve => resolve(currencyLocal)))
      const getCurrenciesRPC = jest.spyOn(RPCStellarTypes, 'localGetDisplayCurrenciesLocalRpcPromise')
      getCurrenciesRPC.mockImplementation(() => new Promise(resolve => resolve(null)))
      const buildRPC = jest.spyOn(RPCStellarTypes, 'localBuildPaymentLocalRpcPromise')
      buildRPC.mockImplementation(() => new Promise(resolve => resolve(buildPaymentRes)))

      // Finally accepted disclaimer.
      dispatch(WalletsGen.createOpenSendRequestForm({to: 'fake recipient'}))
      expect(getState().wallets.building.to).toEqual('fake recipient')
      expect(getRoute(getState)).toEqual(
        I.List([Tabs.walletsTab, 'wallet', Constants.sendReceiveFormRouteKey])
      )
      return Testing.flushPromises({getCurrencyRPC, getCurrenciesRPC, buildRPC})
    })
    .then(({getCurrencyRPC, getCurrenciesRPC, buildRPC}) => {
      expect(getCurrencyRPC).toHaveBeenCalled()
      expect(getCurrenciesRPC).toHaveBeenCalled()
      expect(buildRPC).toHaveBeenCalled()
    })
})

it('build and send payment', () => {
  const {dispatch, getState} = startReduxSaga()
  const buildRPC = jest.spyOn(RPCStellarTypes, 'localBuildPaymentLocalRpcPromise')
  buildRPC.mockImplementation(() => new Promise(resolve => resolve(buildPaymentRes)))

  dispatch(WalletsGen.createBuildPayment())
  return Testing.flushPromises()
    .then(() => {
      const expectedBuiltPayment = Constants.buildPaymentResultToBuiltPayment(buildPaymentRes)
      expect(getState().wallets.builtPayment).toEqual(expectedBuiltPayment)
      expect(buildRPC).toHaveBeenCalled()

      const sendRPC = jest.spyOn(RPCStellarTypes, 'localSendPaymentLocalRpcPromise')
      const sendPaymentResult = {
        kbTxID: 'fake transaction id',
        pending: false,
      }
      sendRPC.mockImplementation(() => new Promise(resolve => resolve(sendPaymentResult)))

      dispatch(WalletsGen.createSendPayment())
      return Testing.flushPromises({sendRPC})
    })
    .then(({sendRPC}) => {
      expect(getState().wallets.builtPayment).toEqual(Constants.makeBuiltPayment())
      expect(sendRPC).toHaveBeenCalled()
    })
})
