import * as Constants from '../constants/provision'
import type * as Types from '../constants/types/provision'
import * as Container from '../util/container'
import * as ProvisionGen from '../actions/provision-gen'
import HiddenString from '../util/hidden-string'

const initialState = Constants.makeState()

export default Container.makeReducer<ProvisionGen.Actions, Types.State>(initialState, {
  [ProvisionGen.resetStore]: () => initialState,
  [ProvisionGen.startProvision]: (_, action) => {
    return {...initialState, initialUsername: action.payload.initUsername ?? initialState.initialUsername}
  },
  [ProvisionGen.provisionError]: (draftState, action) => {
    draftState.error = action.payload.error ?? initialState.error
    draftState.forgotUsernameResult = ''
  },
  [ProvisionGen.showPasswordPage]: (draftState, action) => {
    draftState.error = action.payload.error ?? initialState.error
    draftState.forgotUsernameResult = ''
  },
  [ProvisionGen.showPaperkeyPage]: (draftState, action) => {
    draftState.error = action.payload.error ?? initialState.error
    draftState.forgotUsernameResult = ''
  },
  [ProvisionGen.submitPassword]: draftState => {
    draftState.error = initialState.error
  },
  [ProvisionGen.submitPaperkey]: draftState => {
    draftState.error = initialState.error
  },
  [ProvisionGen.showFinalErrorPage]: (draftState, action) => {
    // Ignore cancels
    if (!Constants.errorCausedByUsCanceling(action.payload.finalError)) {
      draftState.finalError = action.payload.finalError
    }
  },
  [ProvisionGen.showInlineError]: (draftState, action) => {
    draftState.inlineError = action.payload.inlineError
  },
  [ProvisionGen.showNewDeviceNamePage]: (draftState, action) => {
    draftState.error = action.payload.error ?? initialState.error
    draftState.existingDevices = action.payload.existingDevices
  },
  [ProvisionGen.addNewDevice]: (draftState, action) => {
    draftState.error = initialState.error
    draftState.codePageOtherDevice.type = action.payload.otherDeviceType
  },
  [ProvisionGen.showDeviceListPage]: (draftState, action) => {
    draftState.devices = action.payload.devices
    draftState.error = initialState.error
  },
  [ProvisionGen.submitDeviceSelect]: (draftState, action) => {
    const selectedDevice = draftState.devices.find(d => d.name === action.payload.name)
    if (!selectedDevice) {
      throw new Error('Selected a non existant device?')
    }
    draftState.codePageOtherDevice = selectedDevice
    draftState.error = initialState.error
  },
  [ProvisionGen.submitTextCode]: (draftState, action) => {
    // clean up spaces
    const good = action.payload.phrase.stringValue().replace(/\W+/g, ' ').trim()
    draftState.codePageOutgoingTextCode = new HiddenString(good)
    draftState.error = initialState.error
  },
  [ProvisionGen.submitDeviceName]: (draftState, action) => {
    draftState.deviceName = action.payload.name
    draftState.error = initialState.error
  },
  [ProvisionGen.showCodePage]: (draftState, action) => {
    draftState.codePageIncomingTextCode = action.payload.code
    draftState.error = action.payload.error || initialState.error
  },
  [ProvisionGen.submitUsername]: (draftState, action) => {
    draftState.error = initialState.error
    draftState.finalError = undefined
    draftState.inlineError = undefined
    draftState.username = action.payload.username
  },
  [ProvisionGen.switchToGPGSignOnly]: (draftState, action) => {
    draftState.gpgImportError = action.payload.importError
  },
  [ProvisionGen.submitGPGSignOK]: draftState => {
    draftState.gpgImportError = undefined
  },
  [ProvisionGen.forgotUsernameResult]: (draftState, action) => {
    draftState.forgotUsernameResult = action.payload.result
  },
})
