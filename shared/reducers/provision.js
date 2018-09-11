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
    case ProvisionGen.startProvision:
      return initialState
    case ProvisionGen.provisionError:
    case ProvisionGen.showPassphrasePage: // fallthrough
    case ProvisionGen.showPaperkeyPage: // fallthrough
      return state.set('error', action.payload.error || initialState.error)
    case ProvisionGen.submitPassphrase: // fallthrough
    case ProvisionGen.submitPaperkey:
      return state.merge({error: initialState.error})
    case ProvisionGen.showFinalErrorPage:
      // Ignore cancels
      if (action.payload.finalError && action.payload.finalError.desc === Constants.cancelDesc) {
        return state
      }
      return state.merge({finalError: action.payload.finalError})
    case ProvisionGen.showNewDeviceNamePage:
      return state.merge({
        error: action.payload.error || initialState.error,
        existingDevices: I.List(action.payload.existingDevices),
      })
    case ProvisionGen.addNewDevice:
      return state.merge({
        codePageOtherDeviceType: action.payload.otherDeviceType,
        error: initialState.error,
      })
    case ProvisionGen.showDeviceListPage:
      return state.merge({
        devices: I.List(action.payload.devices),
        error: initialState.error,
      })
    case ProvisionGen.submitDeviceSelect:
      const selectedDevice = state.devices.find(d => d.name === action.payload.name)
      if (!selectedDevice) {
        throw new Error('Selected a non existant device?')
      }
      return state.merge({
        codePageOtherDeviceId: selectedDevice.id,
        codePageOtherDeviceName: selectedDevice.name,
        // only desktop or mobile, paperkey we treat as mobile but its never used in the flow
        codePageOtherDeviceType: selectedDevice.type === 'desktop' ? 'desktop' : 'mobile',
        error: initialState.error,
      })
    case ProvisionGen.submitTextCode:
      return state.merge({
        codePageOutgoingTextCode: action.payload.phrase,
        error: initialState.error,
      })
    case ProvisionGen.submitDeviceName:
      const newNameLowerCase = action.payload.name.toLowerCase()
      if (state.existingDevices.find(ed => ed.toLowerCase() === newNameLowerCase)) {
        return state.merge({
          deviceName: action.payload.name,
          error: new HiddenString(
            `The device name '${
              action.payload.name
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
        codePageIncomingTextCode: action.payload.code,
        error: action.payload.error || initialState.error,
      })
    case ProvisionGen.submitUsernameOrEmail:
      return state.merge({
        error: initialState.error,
        finalError: null,
        usernameOrEmail: action.payload.usernameOrEmail,
      })
    case ProvisionGen.switchToGPGSignOnly:
      return state.set('gpgImportError', action.payload.importError)
    case ProvisionGen.submitGPGSignOK:
      return state.set('gpgImportError', null)
    // Saga only actions
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
