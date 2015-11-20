import * as Constants from '../constants/devices'

const initialState = {
  waitingForServer: false,
  response: null,
  devices: null,
  error: null,
  paperKey: null
}

export default function (state = initialState, action) {
  switch (action.type) {
    case Constants.loadingDevices:
      return {
        ...state,
        error: null,
        waitingForServer: true
      }
    case Constants.showDevices:
      return {
        ...state,
        error: action.error && action.payload,
        devices: action.error ? [] : action.payload,
        waitingForServer: false
      }
    case Constants.deviceRemoved:
      return {
        ...state,
        waitingForServer: false
      }
    case Constants.paperKeyLoading:
      return {
        ...state,
        error: null,
        paperKey: null
      }
    case Constants.paperKeyLoaded:
      return {
        ...state,
        error: action.error && action.payload,
        paperKey: action.error ? null : action.payload
      }
    default:
      return state
  }
}
