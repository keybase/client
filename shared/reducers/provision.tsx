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
    case ProvisionGen.startProvision:
      return action.payload && action.payload.initUsername
        ? initialState.merge({initialUsername: action.payload.initUsername})
        : initialState
    case ProvisionGen.provisionError:
    case ProvisionGen.showPasswordPage: // fallthrough
    case ProvisionGen.showPaperkeyPage: // fallthrough
      return state.merge({
        error: action.payload.error || initialState.error,
        forgotUsernameResult: '',
      })
    case ProvisionGen.submitPassword: // fallthrough
    case ProvisionGen.submitPaperkey:
      return state.merge({error: initialState.error})
    case ProvisionGen.showFinalErrorPage:
      // Ignore cancels
      if (Constants.errorCausedByUsCanceling(action.payload.finalError)) {
        return state
      }
      return state.merge({finalError: action.payload.finalError})
    case ProvisionGen.showInlineError:
      return state.merge({
        inlineError: action.payload.inlineError,
      })
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
    case ProvisionGen.submitDeviceSelect: {
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
    }
    case ProvisionGen.submitTextCode: {
      // clean up spaces
      const good = action.payload.phrase
        .stringValue()
        .replace(/\W+/g, ' ')
        .trim()
      return state.merge({
        codePageOutgoingTextCode: new HiddenString(good),
        error: initialState.error,
      })
    }
    case ProvisionGen.submitDeviceName:
      return state.merge({
        deviceName: action.payload.name,
        error: initialState.error,
      })
    case ProvisionGen.showCodePage:
      return state.merge({
        codePageIncomingTextCode: action.payload.code,
        error: action.payload.error || initialState.error,
      })
    case ProvisionGen.submitUsername:
      return state.merge({
        error: initialState.error,
        finalError: null,
        inlineError: null,
        username: action.payload.username,
      })
    case ProvisionGen.switchToGPGSignOnly:
      return state.merge({gpgImportError: action.payload.importError})
    case ProvisionGen.submitGPGSignOK:
      return state.merge({gpgImportError: null})
    case ProvisionGen.forgotUsernameResult:
      return state.merge({forgotUsernameResult: action.payload.result})
    // Saga only actions
    case ProvisionGen.forgotUsername:
    case ProvisionGen.showGPGPage:
    case ProvisionGen.submitGPGMethod:
      return state
    default:
      return state
  }
}
