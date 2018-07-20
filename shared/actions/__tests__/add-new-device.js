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

const makeInit = (p: {method: string, payload: any, state?: Types.State}) => {
  const manager = _testing.makeProvisioningManager(true)
  const callMap = manager.getIncomingCallMap()
  const call = callMap[p.method]
  if (!call) {
    throw new Error('No call')
  }
  const state = p.state || Constants.makeState()
  const response: any = {error: jest.fn(), result: jest.fn()}
  const put: any = call(p.payload, response, makeTypedState(state))
  if (!put) {
    return {action: null, callMap, manager, nextState: makeTypedState(state), response, state}
  }
  if (!put || !put.PUT) {
    throw new Error('no put')
  }
  const action = put.PUT.action
  const nextState = makeTypedState(reducer(state, action))
  return {action, callMap, manager, nextState, response, state}
}

const makeTypedState = (provisionState: Types.State): TypedState => ({provision: provisionState}: any)
const noError = new HiddenString('')

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
  const phrase = new HiddenString('incomingSecret')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
      payload: {phrase: phrase.stringValue()},
    })
  })

  it('init', () => {
    const {manager, response, nextState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(nextState.provision.codePageTextCode).toEqual(phrase)
    expect(nextState.provision.error).toEqual(noError)
  })

  it('shows the code page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowCodePage({code: phrase, error: null}))
  })

  it('navs to the code page', () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.devicesTab]))
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
    const {manager, response, nextState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(nextState.provision.codePageTextCode).toEqual(phrase)
    expect(nextState.provision.error).toEqual(error)
  })

  it('shows the code page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowCodePage({code: phrase, error}))
  })

  it("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toBeFalsy()
  })

  it("won't let submit on error", () => {
    const {response, nextState} = init
    expect(_testing.submitTextCode(nextState)).toBeFalsy()
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit clears error and submits', () => {
    const {response, state} = init
    const reply = 'reply'
    const submitAction = ProvisionGen.createSubmitTextCode({phrase: new HiddenString(reply)})
    const submitState = makeTypedState(reducer(state, submitAction))
    expect(submitState.provision.error).toEqual(noError)

    _testing.submitTextCode(submitState)
    expect(response.result).toHaveBeenCalledWith({code: null, phrase: reply})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitTextCode(submitState)).toThrow()
  })
})

describe('reply with device type', () => {
  // a little different as we automatically respond so no typical makeInit call
  it('init with mobile', () => {
    const state = Constants.makeState()
    const action = ProvisionGen.createAddNewDevice({otherDeviceType: 'mobile'})
    const nextState = reducer(state, action)
    const {manager, response} = makeInit({
      method: 'keybase.1.provisionUi.chooseDeviceType',
      payload: {},
      state: nextState,
    })
    // we don't stash we reply immediately
    expect(manager._stashedResponse).toEqual(null)
    expect(manager._stashedResponseKey).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(RPCTypes.commonDeviceType.mobile)
    expect(response.error).not.toHaveBeenCalled()
  })

  it('init with desktop', () => {
    const state = Constants.makeState()
    const action = ProvisionGen.createAddNewDevice({otherDeviceType: 'desktop'})
    const nextState = reducer(state, action)
    const {manager, response} = makeInit({
      method: 'keybase.1.provisionUi.chooseDeviceType',
      payload: {},
      state: nextState,
    })
    // we don't stash we reply immediately
    expect(manager._stashedResponse).toEqual(null)
    expect(manager._stashedResponseKey).toEqual(null)
    expect(response.result).toHaveBeenCalledWith(RPCTypes.commonDeviceType.desktop)
    expect(response.error).not.toHaveBeenCalled()
  })

  it('error with anything else', () => {
    const state = Constants.makeState()
    // $FlowIssue flow is correct, we don't allow this
    const action = ProvisionGen.createAddNewDevice({otherDeviceType: 'backup'})
    const nextState = reducer(state, action)
    expect(() =>
      makeInit({method: 'keybase.1.provisionUi.chooseDeviceType', payload: {}, state: nextState})
    ).toThrow()
  })
})
