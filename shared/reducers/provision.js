// @flow
import * as I from 'immutable'
import * as Constants from '../constants/provision'
import * as Types from '../constants/types/provision'
import * as ProvisionGen from '../actions/provision-gen'
import HiddenString from '../util/hidden-string'
import * as Flow from '../util/flow'

const initialState = Constants.makeState()

export default function(state: Types.State = initialState, action: ProvisionGen.Actions): Types.State {
  switch (action.type) {
    case ProvisionGen.resetStore:
    case ProvisionGen.startProvision:
      return initialState
    case ProvisionGen.provisionError:
    case ProvisionGen.showPassphrasePage: // fallthrough
    case ProvisionGen.showPaperkeyPage: // fallthrough
      return state.merge({error: action.payload.error || initialState.error})
    case ProvisionGen.submitPassphrase: // fallthrough
    case ProvisionGen.submitPaperkey:
      return state.merge({error: initialState.error})
    case ProvisionGen.showFinalErrorPage:
      // Ignore cancels
      if (Constants.errorCausedByUsCanceling(action.payload.finalError)) {
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
      // clean up spaces
      const good = action.payload.phrase
        .stringValue()
        .replace(/\W+/g, ' ')
        .trim()
      return state.merge({
        codePageOutgoingTextCode: new HiddenString(good),
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
      return state.merge({gpgImportError: action.payload.importError})
    case ProvisionGen.submitGPGSignOK:
      return state.merge({gpgImportError: null})
    // Saga only actions
    case ProvisionGen.showGPGPage:
    case ProvisionGen.submitGPGMethod:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}
