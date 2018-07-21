// @flow
/* eslint-env jest */
import * as I from 'immutable'
import * as Types from '../../constants/types/provision'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/provision'
import * as Tabs from '../../constants/tabs'
import * as ProvisionGen from '../provision-gen'
import * as RouteTree from '../route-tree'
import * as Saga from '../../util/saga'
import HiddenString from '../../util/hidden-string'
import type {TypedState} from '../../constants/reducer'
import {_testing} from '../provision'
import {RPCError} from '../../util/errors'
import {createStore, applyMiddleware, combineReducers} from 'redux'
import provisionReducer from '../../reducers/provision'
import configReducer from '../../reducers/config'
import createSagaMiddleware from 'redux-saga'
import provisionSaga from '../../actions/provision'

// redux method todo
// do full store . fix route tree
// undo skips

const reducer = provisionReducer
const noError = new HiddenString('')

const provStateToTypedState = (provisionState: Types.State): TypedState => ({provision: provisionState}: any)
const makeNextState = (state: TypedState, action) => provStateToTypedState(reducer(state.provision, action))

// Sets up redux and the provision manager. Starts by making an incoming call into the manager
const makeInit = ({method, payload}) => {
  const {dispatch, getState} = startReduxSaga()
  const manager = _testing.makeProvisioningManager(false)
  const callMap = manager.getIncomingCallMap()
  const mockIncomingCall = callMap[method]
  if (!mockIncomingCall) {
    throw new Error('No call')
  }
  const response = {error: jest.fn(), result: jest.fn()}
  const put: any = mockIncomingCall((payload: any), (response: any), getState())
  // We also put an action on an incoming call
  if (!put || !put.PUT) {
    throw new Error('no put')
  }
  dispatch(put.PUT.action)
  return {
    dispatch,
    getState,
    manager,
    response,
  }
}

const startReduxSaga = () => {
  const sagaMiddleware = createSagaMiddleware({
    onError: e => {
      throw e
    },
  })
  const rootReducer = combineReducers({config: configReducer, provision: provisionReducer})
  const store = createStore(rootReducer, undefined, applyMiddleware(sagaMiddleware))
  sagaMiddleware.run(provisionSaga)
  return {
    dispatch: store.dispatch,
    getState: (store.getState: any),
  }
}

describe('provisioningManagerProvisioning', () => {
  const manager = _testing.makeProvisioningManager(false)
  const callMap = manager.getIncomingCallMap()

  it('cancels are correct', () => {
    const keys = ['keybase.1.gpgUi.selectKey', 'keybase.1.loginUi.getEmailOrUsername']
    keys.forEach(k => {
      const response = {error: jest.fn(), result: jest.fn()}
      // $FlowIssue
      callMap[k](undefined, response, undefined)
      expect(response.result).not.toHaveBeenCalled()
      expect(response.error).toHaveBeenCalledWith({
        code: RPCTypes.constantsStatusCode.scgeneric,
        desc: 'Canceling RPC',
      })
    })
  })

  it('ignores are correct', () => {
    const keys = [
      'keybase.1.loginUi.displayPrimaryPaperKey',
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

  // TODO route tree stuff w/ new redux saga hooks
  it.skip('navs to the code page', () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.loginTab, 'login']))
    )
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

  it.skip("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toBeFalsy()
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

describe('device name empty', () => {
  const existingDevices = I.List()
  const init = makeInit({
    method: 'keybase.1.provisionUi.PromptNewDeviceName',
    payload: {errorMessage: '', existingDevices: null},
  })

  const {getState} = init
  expect(getState().provision.existingDevices).toEqual(existingDevices)
  expect(getState().provision.error).toEqual(noError)
})

describe('device name happy path', () => {
  const existingDevices = I.List(['dev1', 'dev2', 'dev3'])
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.PromptNewDeviceName',
      payload: {errorMessage: '', existingDevices: existingDevices.toArray()},
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.existingDevices).toEqual(existingDevices)
    expect(getState().provision.error).toEqual(noError)
  })

  it.skip('navs to device name page', () => {
    const {nextState} = init
    expect(_testing.showNewDeviceNamePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['setPublicName'], [Tabs.loginTab, 'login']))
    )
  })

  it("don't allow submit dupe", () => {
    const {response, getState, dispatch} = init
    const name: string = (existingDevices.first(): any)
    dispatch(ProvisionGen.createSubmitDeviceName({name}))
    expect(
      getState()
        .provision.error.stringValue()
        .indexOf('is already taken')
    ).not.toEqual(-1)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit', () => {
    const {response, getState, dispatch} = init
    const name = 'new name'
    dispatch(ProvisionGen.createSubmitDeviceName({name}))
    expect(response.result).toHaveBeenCalledWith(name)
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    dispatch(ProvisionGen.createSubmitDeviceName({name}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('device name error path', () => {
  const existingDevices = I.List([])
  const error = new HiddenString('invalid name')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.PromptNewDeviceName',
      payload: {errorMessage: error.stringValue(), existingDevices: existingDevices.toArray()},
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.existingDevices).toEqual(existingDevices)
    expect(getState().provision.error).toEqual(error)
  })

  it.skip("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showNewDeviceNamePage(nextState)).toBeFalsy()
  })

  it('update name and submit clears error and submits', () => {
    const {response, getState, dispatch} = init
    const name = 'new name'
    dispatch(ProvisionGen.createSubmitDeviceName({name}))
    expect(getState().provision.error).toEqual(noError)
    expect(response.result).toHaveBeenCalledWith(name)
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitDeviceName({name}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('other device happy path', () => {
  const mobile = ({deviceID: '0', name: 'mobile', type: 'mobile'}: any)
  const desktop = ({deviceID: '1', name: 'desktop', type: 'desktop'}: any)
  const backup = ({deviceID: '2', name: 'backup', type: 'backup'}: any)
  const rpcDevices = [mobile, desktop, backup]
  const devices = I.List(rpcDevices.map(Constants.rpcDeviceToDevice))
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseDevice',
      payload: {devices: rpcDevices},
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.devices).toEqual(devices)
    expect(getState().provision.error).toEqual(noError)
  })

  it.skip('navs to device page', () => {
    const {nextState} = init
    expect(_testing.showDeviceListPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['selectOtherDevice'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit mobile', () => {
    const {response, getState, dispatch} = init
    dispatch(ProvisionGen.createSubmitDeviceSelect({name: mobile.name}))
    expect(getState().provision.codePageOtherDeviceId).toEqual(mobile.deviceID)
    expect(getState().provision.codePageOtherDeviceType).toEqual('mobile')
    expect(getState().provision.error).toEqual(noError)
    expect(getState().config.globalError).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(mobile.deviceID)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    dispatch(ProvisionGen.createSubmitDeviceSelect({name: mobile.name}))
    expect(getState().config.globalError).not.toEqual(null)
  })

  it('submit desktop', () => {
    const {response, getState, dispatch} = init
    dispatch(ProvisionGen.createSubmitDeviceSelect({name: desktop.name}))
    expect(getState().provision.codePageOtherDeviceId).toEqual(desktop.deviceID)
    expect(getState().provision.codePageOtherDeviceType).toEqual('desktop')
    expect(getState().provision.error).toEqual(noError)
    expect(getState().config.globalError).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(desktop.deviceID)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    dispatch(ProvisionGen.createSubmitDeviceSelect({name: desktop.name}))
    expect(getState().config.globalError).not.toEqual(null)
  })

  it('submit paperkey/backup', () => {
    const {response, getState, dispatch} = init
    dispatch(ProvisionGen.createSubmitDeviceSelect({name: backup.name}))
    expect(getState().provision.codePageOtherDeviceId).toEqual(backup.deviceID)
    expect(getState().provision.codePageOtherDeviceType).toEqual('mobile')
    expect(getState().provision.error).toEqual(noError)
    expect(getState().config.globalError).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(backup.deviceID)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    dispatch(ProvisionGen.createSubmitDeviceSelect({name: backup.name}))
    expect(getState().config.globalError).not.toEqual(null)
  })

  it('doesnt allow unknown', () => {
    const {dispatch} = init
    expect(() => dispatch(ProvisionGen.createSubmitDeviceSelect({name: 'not there'}))).toThrow()
  })
})

describe('other device error path', () => {
  it('doesnt have errors', () => {
    // Actually no error path for chooseDevice
  })
})

describe('other device no devices', () => {
  let init
  const rpcDevices = null
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseDevice',
      payload: {devices: rpcDevices},
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.devices).toEqual(I.List())
    expect(getState().provision.error).toEqual(noError)
  })
})

describe('choose gpg happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseGPGMethod',
      payload: {},
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error.stringValue()).toEqual('')
  })

  it.skip('navs to the gpg page', () => {
    const {nextState} = init
    expect(_testing.showGPGPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['gpgSign'], [Tabs.loginTab, 'login']))
    )
  })

  it('no submit on error', () => {
    const {response, dispatch} = init
    // shouldn't really be possible, but inject an error
    dispatch(ProvisionGen.createShowPaperkeyPage({error: new HiddenString('something')}))
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: true}))
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit export key', () => {
    const {response, getState, dispatch} = init
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: true}))
    expect(response.result).toHaveBeenCalledWith(RPCTypes.provisionUiGPGMethod.gpgImport)
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: true}))
    expect(getState().config.globalError).not.toEqual(null)
  })

  it('submit sign key', () => {
    const {response, getState, dispatch} = init
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: false}))
    expect(response.result).toHaveBeenCalledWith(RPCTypes.provisionUiGPGMethod.gpgSign)
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: false}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('passphrase happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: null,
          type: RPCTypes.passphraseCommonPassphraseType.passPhrase,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(noError)
  })

  it.skip('navs to password page', () => {
    const {nextState} = init
    expect(_testing.showPassphrasePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['passphrase'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit', () => {
    const {response, getState, dispatch} = init
    const passphrase = new HiddenString('a passphrase')
    dispatch(ProvisionGen.createSubmitPassphrase({passphrase}))
    expect(response.result).toHaveBeenCalledWith({passphrase: passphrase.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitPassphrase({passphrase}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('passphrase error path', () => {
  const error = new HiddenString('invalid passphrase')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: error.stringValue(),
          type: RPCTypes.passphraseCommonPassphraseType.passPhrase,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(error)
  })

  it.skip("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showPassphrasePage(nextState)).toBeFalsy()
  })

  it('submit clears error and submits', () => {
    const {response, getState, dispatch} = init
    const passphrase = new HiddenString('a passphrase')
    dispatch(ProvisionGen.createSubmitPassphrase({passphrase}))
    expect(getState().provision.error).toEqual(noError)
    expect(response.result).toHaveBeenCalledWith({passphrase: passphrase.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitPassphrase({passphrase}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('paperkey happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: null,
          type: RPCTypes.passphraseCommonPassphraseType.paperKey,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(noError)
  })

  it.skip('navs to paperkey page', () => {
    const {nextState} = init
    expect(_testing.showPaperkeyPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['paperkey'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit', () => {
    const {response, getState, dispatch} = init
    const paperkey = new HiddenString('one two three four five six seven eight')
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey}))
    expect(response.result).toHaveBeenCalledWith({passphrase: paperkey.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('paperkey error path', () => {
  const error = new HiddenString('invalid paperkey')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: error.stringValue(),
          type: RPCTypes.passphraseCommonPassphraseType.paperKey,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(error)
  })

  it.skip("doesn't nav away", () => {
    const {getState} = init
    expect(_testing.showPaperkeyPage(getState())).toBeFalsy()
  })

  it('submit clears error and submits', () => {
    const {response, getState, dispatch} = init
    const paperkey = new HiddenString('eight seven six five four three two one')
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey}))
    expect(getState().provision.error).toEqual(noError)
    expect(response.result).toHaveBeenCalledWith({passphrase: paperkey.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('canceling provision', () => {
  it('ignores other paths', () => {
    const manager = _testing.makeProvisioningManager(false)
    const state: any = {
      routeTree: {
        routeState: {
          selected: Tabs.chatTab,
        },
      },
    }
    const response = {error: jest.fn(), result: jest.fn()}

    // start the process so we get something stashed
    manager._stashResponse('keybase.1.gpgUi.selectKey', response)

    _testing.maybeCancelProvision(state)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
    expect(manager._stashedResponse).not.toEqual(null)
    expect(manager._stashedResponseKey).not.toEqual(null)
  })

  it('cancels', () => {
    const manager = _testing.makeProvisioningManager(false)
    const state: any = {
      routeTree: {
        routeState: {
          selected: Tabs.loginTab,
        },
      },
    }
    const response = {error: jest.fn(), result: jest.fn()}

    // start the process so we get something stashed
    manager._stashResponse('keybase.1.gpgUi.selectKey', response)

    _testing.maybeCancelProvision(state)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).toHaveBeenCalledWith({
      code: RPCTypes.constantsStatusCode.scgeneric,
      desc: 'Canceling RPC',
    })
    expect(manager._stashedResponse).toEqual(null)
    expect(manager._stashedResponseKey).toEqual(null)
  })
})

describe('final errors show', () => {
  it('shows the final error page', () => {
    const {getState, dispatch} = startReduxSaga()
    const error = new RPCError('something bad happened', 1, [])
    dispatch(ProvisionGen.createShowFinalErrorPage({finalError: error}))
    expect(getState().provision.finalError).toBeTruthy()

    // TODO
    // expect(_testing.showFinalErrorPage(nextState)).toEqual(
    // Saga.put(RouteTree.navigateAppend(['error'], [Tabs.loginTab, 'login']))
    // )
  })
})

describe('manager', () => {
  it('complains about invalid response key', () => {
    const manager = _testing.makeProvisioningManager(false)
    const stashed = () => {
      console.log('whu')
    }
    manager._stashResponse('keybase.1.gpgUi.selectKey', stashed)
    expect(() => manager._getAndClearResponse('keybase.1.loginUi.getEmailOrUsername')).toThrow()
  })
  it('complains about no response key', () => {
    const manager = _testing.makeProvisioningManager(false)
    expect(() => manager._getAndClearResponse('keybase.1.loginUi.getEmailOrUsername')).toThrow()
  })
  it('stashing works', () => {
    const manager = _testing.makeProvisioningManager(false)
    const stashed = () => {
      console.log('whu')
    }
    manager._stashResponse('keybase.1.gpgUi.selectKey', stashed)
    expect(manager._getAndClearResponse('keybase.1.gpgUi.selectKey')).toEqual(stashed)
  })
})
