// @flow
/* eslint-env jest */
import * as Types from '../../constants/types/provision'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/provision'
import * as LoginGen from '../provision-gen'
import * as Saga from '../../util/saga'
import type {TypedState} from '../../constants/reducer'
// import {loginTab} from '../../constants/tabs'
// import HiddenString from '../../util/hidden-string'
import {navigateUp, navigateTo, navigateAppend} from '../route-tree'
import {_testing} from '../provision'
import reducer from '../../reducers/provision'

jest.unmock('immutable')

const makeTypedState = (provisionState: Types.State): TypedState => ({provision: provisionState}: any)

describe('provisioningManagerProvisioning', () => {
  const m = new _testing.ProvisioningManager(false)
  const callMap = m.getIncomingCallMap()

  it('cancels are correct', () => {
    const keys = ['keybase.1.gpgUi.selectKey', 'keybase.1.loginUi.getEmailOrUsername']
    keys.forEach(k => {
      const r = {error: jest.fn(), result: jest.fn()}
      // $FlowIssue
      callMap[k](undefined, r, undefined)
      expect(r.result).not.toHaveBeenCalled()
      expect(r.error).toHaveBeenCalledWith({
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
      const r = {error: jest.fn(), result: jest.fn()}
      // $FlowIssue
      callMap[k](undefined, r, undefined)
      expect(r.result).not.toHaveBeenCalled()
      expect(r.error).not.toHaveBeenCalled()
    })
  })

  // 'keybase.1.provisionUi.DisplayAndPromptSecret': this.displayAndPromptSecretHandler,
  // 'keybase.1.provisionUi.PromptNewDeviceName': this.promptNewDeviceNameHandler,
  // 'keybase.1.provisionUi.chooseDevice': this.chooseDeviceHandler,
  // 'keybase.1.provisionUi.chooseGPGMethod': this.chooseGPGMethodHandler,
  // 'keybase.1.secretUi.getPassphrase': this.getPassphraseHandler,
  // it('fills inviteCode, shows invite screen', () => {
  // const action = SignupGen.createRequestedAutoInvite({inviteCode: 'hello world'})
  // const nextState = makeTypedState(reducer(state, action))
  // expect(nextState.signup.inviteCode).toEqual(action.payload.inviteCode)
  // expect(_testing.showInviteScreen()).toEqual(navigateTo([loginTab, 'signup', 'inviteCode']))
  // })
})

describe('provisioningManagerAddNewDevice', () => {})
