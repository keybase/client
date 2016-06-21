import * as Constants from '../constants/devices'
import * as CommonConstants from '../constants/common'

const initialState = {
  waitingForServer: false,
  response: null,
  devices: null,
  error: null,
  paperKey: null,
}

export default function (state = initialState, action) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case Constants.loadingDevices:
      return {
        ...state,
        error: null,
        waitingForServer: true,
      }
    case Constants.showDevices:
      return {
        ...state,
        error: action.error && action.payload,
        devices: action.error ? [] : action.payload.map(dev => ({
          name: dev.device.name,
          deviceID: dev.device.deviceID,
          type: dev.device.type,
          created: dev.device.cTime,
          currentDevice: dev.currentDevice,
          provisioner: dev.provisioner,
          provisionedAt: dev.provisionedAt,
          revokedAt: dev.revokedAt,
          lastUsed: dev.device.lastUsedTime,
        })),
        waitingForServer: false,
      }
    case Constants.deviceRemoved:
      return {
        ...state,
        waitingForServer: false,
      }
    case Constants.paperKeyLoading:
      return {
        ...state,
        error: null,
        paperKey: null,
      }
    case Constants.paperKeyLoaded:
      return {
        ...state,
        error: action.error && action.payload,
        paperKey: action.error ? null : action.payload,
      }
    default:
      return state
  }
}
