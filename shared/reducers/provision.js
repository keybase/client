// @flow
import * as I from 'immutable'
import * as Constants from '../constants/provision'
import * as Types from '../constants/types/provision'
import * as ProvisionGen from '../actions/provision-gen'
import HiddenString from '../util/hidden-string'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: ProvisionGen.Actions): Types.State {
  switch (action.type) {
    case ProvisionGen.resetStore:
      return initialState
    case ProvisionGen.provisionError:
    case ProvisionGen.showPassphrasePage: // fallthrough
    case ProvisionGen.showPaperkeyPage: // fallthrough
      return state.set('error', action.payload.error || initialState.error)
    case ProvisionGen.submitPassphrase: // fallthrough
    case ProvisionGen.submitPaperkey:
      return state.merge({error: initialState.error})
    case ProvisionGen.showNewDeviceNamePage:
      return state.merge({
        error: action.payload.error || initialState.error,
        existingDevices: I.List(action.payload.existingDevices),
      })
    case ProvisionGen.showDeviceListPage:
      return state.merge({
        devices: I.List(action.payload.devices),
        error: initialState.error,
      })
    case ProvisionGen.submitDeviceSelect:
      return state.merge({
        error: initialState.error,
        selectedDevice: state.devices.find(d => d.name === action.payload.name),
      })
    case ProvisionGen.submitTextCode:
      return state.merge({
        codePageTextCode: action.payload.phrase,
        error: initialState.error,
      })
    case ProvisionGen.submitDeviceName:
      if (state.existingDevices.indexOf(state.deviceName) !== -1) {
        return state.merge({
          deviceName: action.payload.name,
          error: new HiddenString(
            `The device name: '${
              state.deviceName
            }' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
          ),
        })
      }
      return state.merge({
        deviceName: action.payload.name,
        error: initialState.error,
      })
    case ProvisionGen.showCodePage:
      return state.merge({
        codePageTextCode: action.payload.code,
        error: action.payload.error || initialState.error,
      })
    case ProvisionGen.submitUsernameOrEmail:
      return state.merge({
        error: initialState.error,
        usernameOrEmail: action.payload.usernameOrEmail,
      })
    // Saga only actions
    case ProvisionGen.addNewDevice:
    case ProvisionGen.showGPGPage:
    case ProvisionGen.submitGPGMethod:
      return state
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (action: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(action);
      */
      return state
  }
}
