/* eslint-env jest */
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/provision'
import * as Tabs from '../../constants/tabs'
import * as ProvisionGen from '../provision-gen'
import * as RouteTreeGen from '../route-tree-gen'
import HiddenString from '../../util/hidden-string'
import provisionSaga, {_testing} from '../provision'
import {createStore, applyMiddleware} from 'redux'
import rootReducer, {TypedState} from '../../reducers'
import createSagaMiddleware from 'redux-saga'

const noError = new HiddenString('')

// Sets up redux and the provision manager. Starts by making an incoming call into the manager
const makeInit = ({method, payload, initialStore}: {method: string; payload: any; initialStore?: any}) => {
  const {dispatch, getState, sagaMiddleware} = startReduxSaga(initialStore)
  const manager = _testing.makeProvisioningManager(true)
  const callMap = manager.getCustomResponseIncomingCallMap()
  const mockIncomingCall = callMap[method]
  if (!mockIncomingCall) {
    throw new Error('No call')
  }
  const response = {error: jest.fn(), result: jest.fn()}
  const effect: any = mockIncomingCall(payload as any, response as any)
  if (effect) {
    // Throws in the generator only, so we have to stash it
    let thrown: Error | null = null
    sagaMiddleware.run(function*(): IterableIterator<any> {
      try {
        yield effect
      } catch (e) {
        thrown = e
      }
    })
    if (thrown) {
      throw thrown
    }
  }
  return {
    dispatch,
    getState,
    manager,
    response,
  }
}

type MakeInit = ReturnType<typeof makeInit>

const startReduxSaga = (initialStore?: TypedState) => {
  const sagaMiddleware = createSagaMiddleware({
    onError: e => {
      throw e
    },
  })
  const store = createStore(rootReducer as any, initialStore, applyMiddleware(sagaMiddleware))
  const getState = store.getState
  const dispatch = store.dispatch
  sagaMiddleware.run(provisionSaga)

  dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.devicesTab]}))

  return {
    dispatch,
    getState,
    sagaMiddleware,
  }
}

describe('provisioningManagerAddingDevice', () => {
  const manager = _testing.makeProvisioningManager(true)
  const callMap = manager.getIncomingCallMap()

  it('ignores are correct', () => {
    const keys = [
      'keybase.1.provisionUi.ProvisioneeSuccess',
      'keybase.1.provisionUi.ProvisionerSuccess',
      'keybase.1.provisionUi.DisplaySecretExchanged',
    ]
    keys.forEach(k => {
      const response = {error: jest.fn(), result: jest.fn()}
      callMap[k](undefined, response, undefined)
      expect(response.result).not.toHaveBeenCalled()
      expect(response.error).not.toHaveBeenCalled()
    })
  })
})

describe('text code happy path', () => {
  const incoming = new HiddenString('incomingSecret')
  const outgoing = new HiddenString('outgoingSecret')
  let init: MakeInit
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
      payload: {phrase: incoming.stringValue()},
    })
  })

  it('init', () => {
    const {manager, response, getState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(getState().provision.codePageIncomingTextCode).toEqual(incoming)
    expect(getState().provision.error).toEqual(noError)
  })

  // it('navs to the code page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab, 'codePage']))
  // })

  it('submit text code empty throws', () => {
    const {dispatch, response} = init
    dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString('')}))
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).toHaveBeenCalled()
  })

  it('submit text code', () => {
    const {response, dispatch, getState} = init
    dispatch(ProvisionGen.createSubmitTextCode({phrase: outgoing}))
    expect(response.result).toHaveBeenCalledWith({code: null, phrase: outgoing.stringValue()})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().provision.codePageOutgoingTextCode).toEqual(outgoing)
    expect(getState().provision.error).toEqual(noError)
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitTextCode({phrase: outgoing}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('text code error path', () => {
  const phrase = new HiddenString('incomingSecret')
  const error = new HiddenString('anerror')
  let init: MakeInit
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
      payload: {phrase: phrase.stringValue(), previousErr: error.stringValue()},
    })
  })

  it('init', () => {
    const {manager, response, getState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(getState().provision.codePageIncomingTextCode).toEqual(phrase)
    expect(getState().provision.error).toEqual(error)
  })

  // it("doesn't nav away", () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab]))
  // })

  it('submit clears error and submits', () => {
    const {response, getState, dispatch} = init
    const reply = new HiddenString('reply')
    dispatch(ProvisionGen.createSubmitTextCode({phrase: reply}))
    expect(getState().provision.error).toEqual(noError)

    expect(response.result).toHaveBeenCalledWith({code: null, phrase: reply.stringValue()})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitTextCode({phrase: reply}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('reply with device type', () => {
  // a little different as we automatically respond
  it('init with mobile', () => {
    const {manager, response} = makeInit({
      initialStore: {
        provision: Constants.makeState({
          codePageOtherDeviceType: 'mobile',
        }),
      },
      method: 'keybase.1.provisionUi.chooseDeviceType',
      payload: {},
    })
    // we don't stash we reply immediately
    expect(manager._stashedResponse).toEqual(null)
    expect(manager._stashedResponseKey).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(RPCTypes.DeviceType.mobile)
    expect(response.error).not.toHaveBeenCalled()
  })

  it('init with desktop', () => {
    const {manager, response} = makeInit({
      initialStore: {
        provision: Constants.makeState({
          codePageOtherDeviceType: 'desktop',
        }),
      },
      method: 'keybase.1.provisionUi.chooseDeviceType',
      payload: {},
    })
    // we don't stash we reply immediately
    expect(manager._stashedResponse).toEqual(null)
    expect(manager._stashedResponseKey).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(RPCTypes.DeviceType.desktop)
    expect(response.error).not.toHaveBeenCalled()
  })

  it('error with anything else', () => {
    expect(() =>
      makeInit({
        initialStore: {
          provision: Constants.makeState({
            codePageOtherDeviceType: 'backup',
          } as any),
        },
        method: 'keybase.1.provisionUi.chooseDeviceType',
        payload: {},
      })
    ).toThrow()
  })
})
