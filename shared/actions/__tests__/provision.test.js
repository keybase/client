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

const makeInit = ({method, payload}) => {
  const manager = _testing.makeProvisioningManager(false)
  const callMap = manager.getIncomingCallMap()
  const state = Constants.makeState()
  const call = callMap[method]
  if (!call) {
    throw new Error('No call')
  }
  const response = {error: jest.fn(), result: jest.fn()}
  const put: any = call((payload: any), (response: any), makeTypedState(state))
  if (!put || !put.PUT) {
    throw new Error('no put')
  }
  const action = put.PUT.action
  const nextState = makeTypedState(reducer(state, action))
  return {action, callMap, manager, nextState, response, state}
}

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
  const phrase = 'incomingSecret'
  let init
  beforeEach(() => {
    init = makeInit({method: 'keybase.1.provisionUi.DisplayAndPromptSecret', payload: {phrase}})
  })

  it('init', () => {
    const {action, manager, response, nextState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(action.payload.code.stringValue()).toEqual(phrase)
    expect(nextState.provision.codePageTextCode.stringValue()).toEqual(phrase)
    expect(nextState.provision.error.stringValue()).toEqual('')
  })

  it('shows the code page', () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit text code', () => {
    const {response, state} = init
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
  const phrase = 'incomingSecret'
  const error = 'anerror'
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
      payload: {phrase, previousErr: error},
    })
  })

  it('init', () => {
    const {manager, response, action, nextState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(action.payload.code.stringValue()).toEqual(phrase)
    expect(action.payload.error.stringValue()).toEqual(error)

    expect(nextState.provision.codePageTextCode.stringValue()).toEqual(phrase)
    expect(nextState.provision.error.stringValue()).toEqual(error)
  })

  it('wont show screen on error', () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toBeFalsy()
  })

  it('wont let submit on error', () => {
    const {response, nextState} = init
    expect(_testing.submitTextCode(nextState)).toBeFalsy()
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })
})

describe('device name happy path', () => {
  const existingDevices = ['dev1', 'dev2', 'dev3']
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.PromptNewDeviceName',
      payload: {errorMessage: '', existingDevices},
    })
  })

  it('init', () => {
    const {action, nextState} = init
    expect(action.payload.existingDevices).toEqual(existingDevices)
    expect(action.payload.error).toEqual(null)
    expect(nextState.provision.existingDevices.toArray()).toEqual(existingDevices)
    expect(nextState.provision.error.stringValue()).toEqual('')
  })

  it('dont allow submit dupe', () => {
    const {response, nextState} = init
    const name = existingDevices[0]
    const submitAction = ProvisionGen.createSubmitDeviceName({name})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    expect(submitState.provision.error.stringValue().indexOf('is already taken')).not.toEqual(-1)
    _testing.submitDeviceName(submitState)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit', () => {
    const {response, nextState} = init
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

describe('device name error path', () => {
  const existingDevices = []
  const error = 'invalid name'
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.PromptNewDeviceName',
      payload: {errorMessage: error, existingDevices},
    })
  })

  it('init', () => {
    const {action, nextState} = init
    expect(action.payload.existingDevices).toEqual(existingDevices)
    expect(action.payload.error.stringValue()).toEqual(error)
    expect(nextState.provision.existingDevices.toArray()).toEqual(existingDevices)
    expect(nextState.provision.error.stringValue()).toEqual(error)
  })

  it('no submit on error', () => {
    const {response, nextState} = init
    _testing.submitDeviceName(nextState)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('update name and submit clears error and submits', () => {
    const {response, nextState} = init
    const name = 'new name'
    const submitAction = ProvisionGen.createSubmitDeviceName({name})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    expect(submitState.provision.error.stringValue()).toEqual('')

    _testing.submitDeviceName(submitState)
    expect(response.result).toHaveBeenCalledWith(name)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitDeviceName(submitState)).toThrow()
  })
})

describe('other device happy path', () => {
  const mobile = ({deviceID: '0', name: 'mobile', type: 'mobile'}: any)
  const desktop = ({deviceID: '1', name: 'desktop', type: 'desktop'}: any)
  const backup = ({deviceID: '2', name: 'backup', type: 'backup'}: any)
  const rpcDevices = [mobile, desktop, backup]
  const devices = rpcDevices.map(Constants.rpcDeviceToDevice)
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseDevice',
      payload: {devices: rpcDevices},
    })
  })

  it('init', () => {
    const {action, nextState} = init
    expect(action.payload.devices).toEqual(devices)
    expect(nextState.provision.devices.toArray()).toEqual(devices)
    expect(nextState.provision.error.stringValue()).toEqual('')
  })

  it('mobile', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: mobile.name})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith(mobile.deviceID)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  it('desktop', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: desktop.name})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith(desktop.deviceID)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  it('paperkey/backup', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: backup.name})
    const submitState = makeTypedState(reducer(nextState.provision, submitAction))
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith(backup.deviceID)
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
