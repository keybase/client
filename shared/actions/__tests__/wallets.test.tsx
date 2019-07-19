/* eslint-env jest */
import * as Constants from '../../constants/wallets'
import * as Tabs from '../../constants/tabs'
import * as WalletsGen from '../wallets-gen'
import * as RPCStellarTypes from '../../constants/types/rpc-stellar-gen'
import * as Types from '../../constants/types/wallets'
import * as RouteTreeGen from '../route-tree-gen'
import walletsSaga from '../wallets'
import * as Testing from '../../util/testing'
import HiddenString from '../../util/hidden-string'

jest.mock('../../engine/require')

const blankStore = Testing.getInitialStore()
const initialStore = {
  ...blankStore,
  config: {loggedIn: true, username: 'user'},
  wallets: blankStore.wallets.merge({
    accountMap: blankStore.wallets.accountMap.set(
      Types.stringToAccountID('fake account ID'),
      Constants.makeAccount()
    ),
  }),
}

const startOnWalletsTab = dispatch => {
  dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.walletsTab]}))
}

const startReduxSaga = Testing.makeStartReduxSaga(walletsSaga, initialStore, startOnWalletsTab)

// const getRoute = getState => getRoutePath(getState().routeTree.routeState, [Tabs.walletsTab])

const buildPaymentRes: RPCStellarTypes.BuildPaymentResLocal = {
  amountAvailable: '',
  amountErrMsg: '',
  displayAmountFiat: '$5.00 USD',
  displayAmountXLM: '21.4168160 XLM',
  from: 'fake account ID',
  publicMemoErrMsg: '',
  readyToReview: false,
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
    // expect(getRoute(getState)).toEqual(I.List([Tabs.walletsTab, 'wallet']))
  }

  // Not yet accepted disclaimer.
  assertRedirectToDisclaimer()

  const checkRPC = jest.spyOn(RPCStellarTypes, 'localHasAcceptedDisclaimerLocalRpcPromise')
  checkRPC.mockImplementation(() => Promise.resolve(false))

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
      acceptRPC.mockImplementation(() => Promise.resolve())

      const checkRPC2 = jest.spyOn(RPCStellarTypes, 'localHasAcceptedDisclaimerLocalRpcPromise')
      checkRPC2.mockImplementation(() => Promise.resolve(true))

      dispatch(WalletsGen.createAcceptDisclaimer())
      dispatch(WalletsGen.createCheckDisclaimer({nextScreen: 'openWallet'}))
      return Testing.flushPromises({acceptRPC, checkRPC2})
    })
    .then(({acceptRPC, checkRPC2}) => {
      expect(getState().wallets.acceptedDisclaimer).toEqual(true)
      expect(acceptRPC).toHaveBeenCalled()
      expect(checkRPC2).toHaveBeenCalled()
      const getCurrenciesRPC = jest.spyOn(RPCStellarTypes, 'localGetDisplayCurrenciesLocalRpcPromise')
      getCurrenciesRPC.mockImplementation(() => Promise.resolve(null))
      const startPaymentRPC = jest.spyOn(RPCStellarTypes, 'localStartBuildPaymentLocalRpcPromise')
      startPaymentRPC.mockImplementation(() => Promise.resolve('fake build ID'))
      const buildRPC = jest.spyOn(RPCStellarTypes, 'localBuildPaymentLocalRpcPromise')
      buildRPC.mockImplementation(() => Promise.resolve(buildPaymentRes))

      // Finally accepted disclaimer.
      dispatch(WalletsGen.createOpenSendRequestForm({to: 'fake recipient'}))
      expect(getState().wallets.building.to).toEqual('fake recipient')
      // expect(getRoute(getState)).toEqual(
      // I.List([Tabs.walletsTab, 'wallet', Constants.sendRequestFormRouteKey])
      // )
      return Testing.flushPromises({buildRPC, getCurrenciesRPC, startPaymentRPC})
    })
    .then(({getCurrenciesRPC, buildRPC, startPaymentRPC}) => {
      expect(getCurrenciesRPC).toHaveBeenCalled()
      expect(startPaymentRPC).toHaveBeenCalled()
      expect(buildRPC).toHaveBeenCalled()
    })
})

it('build and send payment', () => {
  const {dispatch, getState} = startReduxSaga()
  const buildRPC = jest.spyOn(RPCStellarTypes, 'localBuildPaymentLocalRpcPromise')
  buildRPC.mockImplementation(() => Promise.resolve(buildPaymentRes))

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
      sendRPC.mockImplementation(() => Promise.resolve(sendPaymentResult))

      dispatch(WalletsGen.createSendPayment())
      return Testing.flushPromises({sendRPC})
    })
    .then(({sendRPC}) => {
      expect(getState().wallets.builtPayment).toEqual(Constants.makeBuiltPayment())
      expect(sendRPC).toHaveBeenCalled()
    })
})

const buildRequestRes: RPCStellarTypes.BuildRequestResLocal = {
  amountErrMsg: '',
  displayAmountFiat: '$5.00 USD',
  displayAmountXLM: '21.4168160 XLM',
  readyToRequest: true,
  secretNoteErrMsg: '',
  sendingIntentionXLM: false,
  toErrMsg: '',
  worthDescription: '21.4168160 XLM',
  worthInfo: '$1.00 = 4.2833632 XLM\nSource: coinmarketcap.com',
}

it('build and send request', () => {
  const {dispatch, getState} = startReduxSaga()
  const buildRPC = jest.spyOn(RPCStellarTypes, 'localBuildRequestLocalRpcPromise')
  buildRPC.mockImplementation(() => Promise.resolve(buildRequestRes))

  dispatch(WalletsGen.createSetBuildingIsRequest({isRequest: true}))
  return Testing.flushPromises()
    .then(() => {
      const expectedBuiltRequest = Constants.buildRequestResultToBuiltRequest(buildRequestRes)
      expect(getState().wallets.builtRequest).toEqual(expectedBuiltRequest)
      expect(buildRPC).toHaveBeenCalled()

      const requestRPC = jest.spyOn(RPCStellarTypes, 'localMakeRequestLocalRpcPromise')
      const requestResult = 'fake request ID'
      requestRPC.mockImplementation(() => Promise.resolve(requestResult))

      dispatch(WalletsGen.createRequestPayment())
      return Testing.flushPromises({requestRPC})
    })
    .then(({requestRPC}) => {
      expect(getState().wallets.builtRequest).toEqual(Constants.makeBuiltRequest())
      expect(requestRPC).toHaveBeenCalled()
    })
})

const buildingResSecretNote = new HiddenString('please send')
const buildingRes = {
  amount: '5',
  bid: 'fake build ID',
  currency: '123',
  from: Types.noAccountID,
  isRequest: false,
  publicMemo: new HiddenString(''),
  recipientType: 'keybaseUser',
  secretNote: buildingResSecretNote,
  to: 'akalin',
}

it('primes send/request form', () => {
  const {dispatch, getState} = startReduxSaga()
  // accept disclaimer
  const acceptRPC = jest.spyOn(RPCStellarTypes, 'localAcceptDisclaimerLocalRpcPromise')
  acceptRPC.mockImplementation(() => Promise.resolve())

  const checkRPC = jest.spyOn(RPCStellarTypes, 'localHasAcceptedDisclaimerLocalRpcPromise')
  checkRPC.mockImplementation(() => Promise.resolve(true))

  dispatch(WalletsGen.createAcceptDisclaimer())
  dispatch(WalletsGen.createCheckDisclaimer({nextScreen: 'openWallet'}))
  return Testing.flushPromises()
    .then(() => {
      const startPaymentRPC = jest.spyOn(RPCStellarTypes, 'localStartBuildPaymentLocalRpcPromise')
      startPaymentRPC.mockImplementation(() => Promise.resolve('fake build ID'))

      const buildRPC = jest.spyOn(RPCStellarTypes, 'localBuildPaymentLocalRpcPromise')
      buildRPC.mockImplementation(() => Promise.resolve(buildPaymentRes))

      dispatch(
        WalletsGen.createOpenSendRequestForm({
          amount: '5',
          currency: '123',
          secretNote: buildingResSecretNote,
          to: 'akalin',
        })
      )
      return Testing.flushPromises({buildRPC, startPaymentRPC})
    })
    .then(({buildRPC, startPaymentRPC}) => {
      expect(startPaymentRPC).toHaveBeenCalled()

      const state = getState()
      // @ts-ignore codemod-issue
      const expectedBuildRes = Constants.makeBuilding(buildingRes)
      expect(state.wallets.building).toEqual(expectedBuildRes)
      // build RPC should have been called last with buildRes
      expect(buildRPC.mock.calls[buildRPC.mock.calls.length - 1]).toEqual([
        {
          amount: expectedBuildRes.amount,
          bid: 'fake build ID',
          currency: '123',
          from: '',
          fromPrimaryAccount: true,
          publicMemo: '',
          secretNote: expectedBuildRes.secretNote.stringValue(),
          to: 'akalin',
          toIsAccountID: false,
        },
        Constants.buildPaymentWaitingKey,
      ])
    })
})
