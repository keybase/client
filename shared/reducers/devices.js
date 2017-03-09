// @flow
import {chain} from 'lodash'
import * as CommonConstants from '../constants/common'
import {List} from 'immutable'

import type {State, Actions} from '../constants/devices'

const initialState: State = {
  devices: List(),
  error: null,
  paperKey: null,
  waitingForServer: false,
}

export default function (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}

    case 'devices:loadingDevices':
      return {
        ...state,
        error: null,
        waitingForServer: true,
      }
    case 'devices:showDevices':
      let devices
      if (action.error) {
        devices = null
      } else {
        devices = chain(action.payload)
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
    case 'devices:removeDevice':
      return {
        ...state,
        waitingForServer: true,
      }
    case 'devices:deviceRemoved':
      return {
        ...state,
        waitingForServer: false,
      }
    case 'devices:paperKeyLoading':
      return {
        ...state,
        error: null,
        paperKey: null,
      }
    case 'devices:paperKeyLoaded':
      return {
        ...state,
        error: action.error && action.payload,
        paperKey: action.error ? null : action.payload,
      }
    default:
      return state
  }
}
