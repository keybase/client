/* eslint-env jest */
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/provision'
import * as Tabs from '../../constants/tabs'
import * as ProvisionGen from '../provision-gen'
import * as RouteTreeGen from '../route-tree-gen'
import HiddenString from '../../util/hidden-string'
import provisionSaga, {_testing} from '../provision'
import {RPCError} from '../../util/errors'
import {createStore, applyMiddleware} from 'redux'
import rootReducer from '../../reducers'
import createSagaMiddleware from 'redux-saga'

jest.mock('../../engine')
jest.mock('../../engine/require')

const noError = new HiddenString('')

// Sets up redux and the provision manager. Starts by making an incoming call into the manager
const makeInit = ({method, payload, initialStore}: {method: string; payload: any; initialStore?: Object}) => {
  const {dispatch, getState, sagaMiddleware} = startReduxSaga(initialStore)
  const manager = _testing.makeProvisioningManager(false)
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

const startReduxSaga = (initialStore?: Object) => {
  const sagaMiddleware = createSagaMiddleware({
    onError: e => {
      throw e
    },
  })
  const store = createStore(rootReducer as any, initialStore, applyMiddleware(sagaMiddleware))
  const getState: () => any = store.getState
  const dispatch = store.dispatch
  sagaMiddleware.run(provisionSaga)

  dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
  dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]}))

  return {
    dispatch,
    getState,
    sagaMiddleware,
  }
}

describe('provisioningManagerProvisioning', () => {
  const manager = _testing.makeProvisioningManager(false)
  const callMap = manager.getCustomResponseIncomingCallMap()

  it('cancels are correct', () => {
    const keys = ['keybase.1.gpgUi.selectKey', 'keybase.1.loginUi.getEmailOrUsername']
    keys.forEach(k => {
      const response = {error: jest.fn(), result: jest.fn()}
      callMap[k](undefined as any, response)
      expect(response.result).not.toHaveBeenCalled()
      expect(response.error).toHaveBeenCalledWith({
        code: RPCTypes.StatusCode.scinputcanceled,
        desc: 'Input canceled',
      })
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

  // it('navs to the code page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'codePage']))
  // })

  it('submit text code empty throws', () => {
    const {dispatch, response} = init
    dispatch(ProvisionGen.createSubmitTextCode({phrase: new HiddenString('')}))
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).toHaveBeenCalled()
  })

  it('submit text code with spaces works', () => {
    const {dispatch, response, getState} = init
    dispatch(
      ProvisionGen.createSubmitTextCode({
        phrase: new HiddenString('   this   is a text   code\n\nthat works'),
      })
    )
    const good = 'this is a text code that works'
    expect(getState().provision.codePageOutgoingTextCode.stringValue()).toEqual(good)
    expect(response.result).toHaveBeenCalledWith({code: null, phrase: good})
    expect(response.error).not.toHaveBeenCalled()
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

  // it("doesn't nav away", () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab]))
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

describe('device name empty', () => {
  const existingDevices = I.List()
  const init = makeInit({
    method: 'keybase.1.provisionUi.PromptNewDeviceName',
    payload: {errorMessage: '', existingDevices: null},
  })

  const {getState}: {getState: () => any} = init
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

  // it('navs to device name page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'setPublicName']))
  // })

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

  // it("doesn't nav away", () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab]))
  // })

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
  const mobile = {deviceID: '0', name: 'mobile', type: 'mobile'} as any
  const desktop = {deviceID: '1', name: 'desktop', type: 'desktop'} as any
  const backup = {deviceID: '2', name: 'backup', type: 'backup'} as any
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

  // it('navs to device page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'selectOtherDevice']))
  // })

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
  let init
  beforeEach(() => {
    // daemon should never do this
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseDevice',
      payload: {devices: null},
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.devices).toEqual(I.List([]))
    expect(getState().provision.error).toEqual(noError)
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

  // it('navs to the gpg page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'gpgSign']))
  // })

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
    expect(response.result).toHaveBeenCalledWith(RPCTypes.GPGMethod.gpgImport)
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: true}))
    expect(getState().config.globalError).not.toEqual(null)
  })

  it('submit sign key', () => {
    const {response, getState, dispatch} = init
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: false}))
    expect(response.result).toHaveBeenCalledWith(RPCTypes.GPGMethod.gpgSign)
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitGPGMethod({exportKey: false}))
    expect(getState().config.globalError).not.toEqual(null)
  })
})

describe('password happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: null,
          type: RPCTypes.PassphraseType.passPhrase,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(noError)
  })

  // it('navs to password page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'password']))
  // })

  it('submit', () => {
    const {response, getState, dispatch} = init
    const password = new HiddenString('a password')
    dispatch(ProvisionGen.createSubmitPassword({password}))
    expect(response.result).toHaveBeenCalledWith({passphrase: password.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitPassword({password}))
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
          type: RPCTypes.PassphraseType.passPhrase,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(error)
  })

  // it("doesn't nav away", () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab]))
  // })

  it('submit clears error and submits', () => {
    const {response, getState, dispatch} = init
    const password = new HiddenString('a password')
    dispatch(ProvisionGen.createSubmitPassword({password}))
    expect(getState().provision.error).toEqual(noError)
    expect(response.result).toHaveBeenCalledWith({passphrase: password.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()
    expect(getState().config.globalError).toEqual(null)

    // only submit once
    dispatch(ProvisionGen.createSubmitPassword({password}))
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
          type: RPCTypes.PassphraseType.paperKey,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(noError)
  })

  // it('navs to paperkey page', () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'paperkey']))
  // })

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
          type: RPCTypes.PassphraseType.paperKey,
        },
      },
    })
  })

  it('init', () => {
    const {getState} = init
    expect(getState().provision.error).toEqual(error)
  })

  // it("doesn't nav away", () => {
  // const {getRoutePath} = init
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab]))
  // })

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
    // you can't be on other paths in the login tab space
  })

  // it('cancels', () => {
  // const {dispatch, response, manager} = makeInit({
  // method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
  // payload: {phrase: 'aaa'},
  // })
  // dispatch(RouteTreeGen.createNavigateUp())
  // expect(response.result).not.toHaveBeenCalled()
  // expect(response.error).toHaveBeenCalledWith({
  // code: RPCTypes.StatusCode.scinputcanceled,
  // desc: 'Input canceled',
  // })
  // expect(manager._stashedResponse).toEqual(null)
  // expect(manager._stashedResponseKey).toEqual(null)
  // })

  // it('clears errors', () => {
  // const {dispatch, getState} = makeInit({
  // method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
  // payload: {phrase: 'aaa'},
  // })
  // const error = new HiddenString('generic error')
  // dispatch(ProvisionGen.createProvisionError({error}))
  // dispatch(RouteTreeGen.createNavigateUp())
  // expect(getState().provision.error).toEqual(noError)
  // expect(getState().provision.finalError).toEqual(null)
  // })
})

describe('start the whole process', () => {
  const {getState, dispatch} = startReduxSaga()
  const error = new HiddenString('generic error')
  dispatch(ProvisionGen.createProvisionError({error}))
  dispatch(ProvisionGen.createStartProvision())
  expect(getState().provision).toEqual(Constants.makeState())
  // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'username']))
})

describe('Submit user email', () => {
  const {getState, dispatch} = startReduxSaga()
  const action = ProvisionGen.createSubmitUsername({username: 'aaa@example.org'})
  dispatch(action)
  expect(getState().provision.username).toEqual(action.payload.username)
  expect(getState().provision.error).toEqual(noError)
  expect(getState().provision.finalError).toEqual(null)
})

describe('generic errors show', () => {
  it('shows error', () => {
    const {getState, dispatch} = startReduxSaga()
    const error = new HiddenString('generic error')
    dispatch(ProvisionGen.createProvisionError({error}))
    expect(getState().provision.error).toEqual(error)
  })
})

describe('final errors show', () => {
  it('shows the final error page', () => {
    const {getState, dispatch} = startReduxSaga()
    const error = new RPCError('something bad happened', 1, [])
    dispatch(ProvisionGen.createShowFinalErrorPage({finalError: error, fromDeviceAdd: false}))
    expect(getState().provision.finalError).toBeTruthy()
    // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab, 'error']))
  })

  it('ignore cancel', () => {
    const {getState, dispatch} = startReduxSaga()
    const error = new RPCError('Input canceled', RPCTypes.StatusCode.scinputcanceled)
    dispatch(ProvisionGen.createShowFinalErrorPage({finalError: error, fromDeviceAdd: false}))
    expect(getState().provision.finalError).toEqual(null)
    // expect(getRoutePath()).toEqual(I.List([Tabs.loginTab]))
  })

  it('shows the final error page (devices add)', () => {
    const {getState, dispatch} = startReduxSaga()
    dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.devicesTab]}))
    // expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab]))
    const error = new RPCError('something bad happened', 1, [])
    dispatch(ProvisionGen.createShowFinalErrorPage({finalError: error, fromDeviceAdd: true}))
    expect(getState().provision.finalError).toBeTruthy()
    // expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab, 'error']))
  })

  it('ignore cancel (devices add)', () => {
    const {getState, dispatch} = startReduxSaga()
    dispatch(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.devicesTab]}))
    const error = new RPCError('Input canceled', RPCTypes.StatusCode.scinputcanceled)
    dispatch(ProvisionGen.createShowFinalErrorPage({finalError: error, fromDeviceAdd: true}))
    expect(getState().provision.finalError).toEqual(null)
    // expect(getRoutePath()).toEqual(I.List([Tabs.devicesTab]))
  })
})

describe('reset works', () => {
  const {getState, dispatch} = startReduxSaga()
  dispatch({payload: {}, type: 'common:resetStore'})
  expect(getState().provision).toEqual(Constants.makeState())
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
