import * as UnlockFoldersGen from '../actions/unlock-folders-gen'
import type * as Types from '../constants/types/unlock-folders'
import * as DeviceTypes from '../constants/types/devices'
import * as Container from '../util/container'

const initialState: Types.State = {
  devices: [],
  phase: 'dead',
  popupOpen: false,
  waiting: false,
}

export default Container.makeReducer<UnlockFoldersGen.Actions, Types.State>(initialState, {
  [UnlockFoldersGen.resetStore]: () => initialState,
  [UnlockFoldersGen.closeDone]: draftState => {
    draftState.popupOpen = false
  },
  [UnlockFoldersGen.onBackFromPaperKey]: draftState => {
    draftState.paperkeyError = ''
    draftState.phase = 'promptOtherDevice'
  },
  [UnlockFoldersGen.toPaperKeyInput]: draftState => {
    draftState.phase = 'paperKeyInput'
  },
  [UnlockFoldersGen.checkPaperKeyDone]: (draftState, action) => {
    const {error} = action.payload
    if (error) {
      draftState.paperkeyError = error
    }
    draftState.phase = 'success'
  },
  [UnlockFoldersGen.finish]: draftState => {
    draftState.phase = 'dead'
    draftState.popupOpen = false
  },
  [UnlockFoldersGen.newRekeyPopup]: (draftState, action) => {
    const {devices, sessionID} = action.payload
    draftState.devices = devices.map(({name, type, deviceID}) => ({
      deviceID,
      name,
      type: DeviceTypes.stringToDeviceType(type),
    }))
    draftState.popupOpen = !!draftState.devices.length
    draftState.sessionID = sessionID
  },
})
