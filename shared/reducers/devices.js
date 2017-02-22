// @flow
import _ from 'lodash'
import * as Constants from '../constants/devices'
import * as CommonConstants from '../constants/common'

import type {State} from '../constants/devices'

const initialState: State = {
  devices: null,
  error: null,
  paperKey: null,
  waitingForServer: false,
}

export default function (state: State = initialState, action: any) {
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
      let devices
      if (action.error) {
        devices = null
      } else {
        devices = _.chain(action.payload)
          .map(dev => ({
            created: dev.device.cTime,
            currentDevice: dev.currentDevice,
            deviceID: dev.device.deviceID,
            lastUsed: dev.device.lastUsedTime,
            name: dev.device.name,
            provisionedAt: dev.provisionedAt,
            provisioner: dev.provisioner,
            revokedAt: dev.revokedAt,
            revokedBy: dev.revokedByDevice,
            type: dev.device.type,
          }))
          .orderBy(['currentDevice', 'name'], ['desc', 'asc'])
          .value()
      }
      return {
        ...state,
        devices,
        error: action.error && action.payload,
        waitingForServer: false,
      }
    case Constants.removeDevice:
      return {
        ...state,
        waitingForServer: true,
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
