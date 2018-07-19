// @flow
/* eslint-env jest */
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
import reducer from '../../reducers/provision'

jest.unmock('immutable')

const makeTypedState = (provisionState: Types.State): TypedState => ({provision: provisionState}: any)

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
  let manager
  let callMap
  let response
  let action
  let state
  const phrase = 'incomingSecret'
  beforeEach(() => {
    manager = _testing.makeProvisioningManager(false)
    callMap = manager.getIncomingCallMap()
    state = Constants.makeState()
    const call = callMap['keybase.1.provisionUi.DisplayAndPromptSecret']
    if (!call) {
      throw new Error('No call')
    }
    response = {error: jest.fn(), result: jest.fn()}
    const put: any = call(({phrase}: any), response, makeTypedState(state))
    if (!put || !put.PUT) {
      throw new Error('no put')
    }
    action = put.PUT.action
  })

  it('init', () => {
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(action.payload.code.stringValue()).toEqual(phrase)
    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.provision.codePageTextCode.stringValue()).toEqual(phrase)
    expect(nextState.provision.error.stringValue()).toEqual('')

    expect(_testing.showCodePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit text code', () => {
    const reply = 'reply'
    const submitAction = ProvisionGen.createSubmitTextCode({phrase: new HiddenString(reply)})
    const submitState = makeTypedState(reducer(state, submitAction))

    _testing.submitTextCode(submitState)
    expect(response.result).toHaveBeenCalledWith({code: null, phrase: reply})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitTextCode(submitState)).toThrow()
  })
})

describe('text code error path', () => {
  let manager
  let callMap
  let response
  let action
  let state
  const phrase = 'incomingSecret'
  const error = 'anerror'
  beforeEach(() => {
    manager = _testing.makeProvisioningManager(false)
    callMap = manager.getIncomingCallMap()
    state = Constants.makeState()
    const call = callMap['keybase.1.provisionUi.DisplayAndPromptSecret']
    if (!call) {
      throw new Error('No call')
    }
    response = {error: jest.fn(), result: jest.fn()}
    const put: any = call(({phrase, previousErr: error}: any), response, makeTypedState(state))
    if (!put || !put.PUT) {
      throw new Error('no put')
    }
    action = put.PUT.action
  })

  it('init', () => {
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(action.payload.code.stringValue()).toEqual(phrase)
    expect(action.payload.error.stringValue()).toEqual(error)

    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.provision.codePageTextCode.stringValue()).toEqual(phrase)
    expect(nextState.provision.error.stringValue()).toEqual(error)

    expect(_testing.showCodePage(nextState)).toBeFalsy()

    expect(_testing.submitTextCode(nextState)).toBeFalsy()
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })
})

describe('device name', () => {
  it('happy path', () => {
    const manager = _testing.makeProvisioningManager(false)
    const callMap = manager.getIncomingCallMap()
    const state = Constants.makeState()
    const call = callMap['keybase.1.provisionUi.PromptNewDeviceName']
    if (!call) {
      throw new Error('No call')
    }

    const response = {error: jest.fn(), result: jest.fn()}
    const existingDevices = []
    const error = 'invalid name'
    const put: any = call(({errorMessage: error, existingDevices}: any), response, makeTypedState(state))
    if (!put || !put.PUT) {
      throw new Error('no put')
    }
    const action = put.PUT.action
    expect(action.payload.existingDevices).toEqual(existingDevices)
    expect(action.payload.error.stringValue()).toEqual(error)

    const nextState = makeTypedState(reducer(state, action))
    expect(nextState.provision.existingDevices.toArray()).toEqual(existingDevices)
    expect(nextState.provision.error.stringValue()).toEqual(error)

    const name = 'new name'
    const submitAction = ProvisionGen.createSubmitDeviceName({name})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))

    _testing.submitDeviceName(submitState)
    expect(response.result).toHaveBeenCalledWith(name)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitDeviceName(submitState)).toThrow()
  })
})

describe('other device happy path', () => {
  let manager
  let nextState
  let action
  let response
  const rpcDevices = [
    ({deviceID: '0', name: 'mobile', type: 'mobile'}: any),
    ({deviceID: '1', name: 'desktop', type: 'desktop'}: any),
    ({deviceID: '2', name: 'backup', type: 'backup'}: any),
  ]
  const devices = rpcDevices.map(Constants.rpcDeviceToDevice)
  beforeEach(() => {
    manager = _testing.makeProvisioningManager(false)
    const callMap = manager.getIncomingCallMap()
    const state = Constants.makeState()
    const call = callMap['keybase.1.provisionUi.chooseDevice']
    if (!call) {
      throw new Error('No call')
    }

    response = {error: jest.fn(), result: jest.fn()}

    const put: any = call(({devices: rpcDevices}: any), response, makeTypedState(state))
    if (!put || !put.PUT) {
      throw new Error('no put')
    }
    action = put.PUT.action
    nextState = makeTypedState(reducer(state, action))
  })

  it('init', () => {
    expect(action.payload.devices).toEqual(devices)
    expect(nextState.provision.devices.toArray()).toEqual(devices)
    expect(nextState.provision.error.stringValue()).toEqual('')
  })

  it('mobile', () => {
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: 'mobile'})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith('0')
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  it('desktop', () => {
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: 'desktop'})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith('1')
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  // TODO should fail
  it('backup', () => {
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: 'backup'})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith('2')
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })
})

// 'keybase.1.provisionUi.': this.chooseDeviceHandler,
// 'keybase.1.provisionUi.chooseGPGMethod': this.chooseGPGMethodHandler,
// 'keybase.1.secretUi.getPassphrase': this.getPassphraseHandler,
// it('fills inviteCode, shows invite screen', () => {
// const action = SignupGen.createRequestedAutoInvite({inviteCode: 'hello world'})
// const nextState = makeTypedState(reducer(state, action))
// expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
// expect(_testing.showInviteScreen()).toEqual(navigateTo([loginTab, 'signup', 'inviteCode']))
// })

describe('provisioningManagerAddNewDevice', () => {})

// TODO
// maybeCancelProvision,
// showDeviceListPage,
// showFinalErrorPage,
// showGPGPage,
// showNewDeviceNamePage,
// showPaperkeyPage,
// showPassphrasePage,
//
// submitDeviceSelect,
// ,
// submitTextCode,
// submitGPGMethod,
// submitPassphraseOrPaperkey
