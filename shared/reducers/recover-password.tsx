import * as I from 'immutable'
import * as Constants from '../constants/recover-password'
import * as Types from '../constants/types/recover-password'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
// import * as ProvisionGen from '../actions/provision-gen'

const initialState = Constants.makeState()

type Actions = RecoverPasswordGen.Actions

export default function(state: Types.State = initialState, action: Actions): Types.State {
  switch (action.type) {
    case RecoverPasswordGen.startRecoverPassword:
      return state.merge({username: action.payload.username})
    // case ProvisionGen.provisionError:
    case RecoverPasswordGen.showDeviceListPage:
      return state.merge({
        devices: I.List(action.payload.devices),
        error: initialState.error,
      })
    /*
    case RecoverPasswordGen.submitDeviceSelect: {
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
    */
    case RecoverPasswordGen.showExplainDevice:
      return state.merge({
        explainedDevice: {
          name: action.payload.name,
          type: action.payload.type,
        },
      })
    case RecoverPasswordGen.submitDeviceSelect:
    default:
      return state
  }
}
