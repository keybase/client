// @flow
/* eslint-env jest */
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/provision'
import * as Tabs from '../../constants/tabs'
import * as ProvisionGen from '../provision-gen'
import * as RouteTree from '../route-tree'
import HiddenString from '../../util/hidden-string'
import provisionSaga, {_testing} from '../provision'
import {createStore, applyMiddleware} from 'redux'
import rootReducer from '../../reducers'
import createSagaMiddleware from 'redux-saga'
import appRouteTree from '../../app/routes-app'
import {getPath as getRoutePath} from '../../route-tree'

const noError = new HiddenString('')

// Sets up redux and the provision manager. Starts by making an incoming call into the manager
const makeInit = ({method, payload, initialStore}: {method: string, payload: any, initialStore?: Object}) => {
  const {dispatch, getState, getRoutePath, sagaMiddleware} = startReduxSaga(initialStore)
  const manager = _testing.makeProvisioningManager(true)
  const callMap = manager.getIncomingCallMap()
  const mockIncomingCall = callMap[method]
  if (!mockIncomingCall) {
    throw new Error('No call')
  }
  const response = {error: jest.fn(), result: jest.fn()}
  const effect: any = mockIncomingCall((payload: any), (response: any))
  if (effect) {
    // Throws in the generator only, so we have to stash it
    let thrown
    sagaMiddleware.run(function*(): Generator<any, any, any> {
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
    getRoutePath,
    getState,
    manager,
    response,
  }
}

const startReduxSaga = (initialStore = undefined) => {
  const sagaMiddleware = createSagaMiddleware({
    onError: e => {
      throw e
    },
  })
  const store = createStore(rootReducer, initialStore, applyMiddleware(sagaMiddleware))
  const getState = store.getState
  const dispatch = store.dispatch
  sagaMiddleware.run(provisionSaga)

  dispatch(RouteTree.switchRouteDef(appRouteTree))
  dispatch(RouteTree.navigateTo([Tabs.devicesTab], null))

  return {
    dispatch,
    getRoutePath: () => getRoutePath(getState().routeTree.routeState, [Tabs.devicesTab]),
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
      // $FlowIssue
      callMap[k](undefined, response, undefined)
      expect(response.result).not.toHaveBeenCalled()
      expect(response.error).not.toHaveBeenCalled()
    })
  })
})

describe('text code happy path', () => {
  const incoming = new HiddenString('incomingSecret')
  const outgoing = new HiddenString('outgoingSecret')
  let init
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

  it('navs to the code page', () => {
    const {getRoutePath} = init
    expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab, 'codePage']))
  })

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
  let init
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

  it("doesn't nav away", () => {
    const {getRoutePath} = init
    expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab]))
  })

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
    expect(response.result).toHaveBeenCalledWith(RPCTypes.commonDeviceType.mobile)
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
    expect(response.result).toHaveBeenCalledWith(RPCTypes.commonDeviceType.desktop)
    expect(response.error).not.toHaveBeenCalled()
  })

  it('error with anything else', () => {
    expect(() =>
      makeInit({
        initialStore: {
          provision: Constants.makeState({
            // $FlowIssue flow correctly doesnt allow this
            codePageOtherDeviceType: 'backup',
          }),
        },
        method: 'keybase.1.provisionUi.chooseDeviceType',
        payload: {},
      })
    ).toThrow()
  })
})
