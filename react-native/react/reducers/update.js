/* @flow */

import * as Constants from '../constants/update'

import type {Asset, UpdateType} from '../constants/types/flow-types'
import type {UpdateActions} from '../constants/update'

export type ShowUpdateState = {
  started: boolean,
  closed: boolean,
  newVersion: ?string,
  description: ?string,
  type: ?UpdateType,
  asset: ?Asset,
  windowTitle: ?string,
  oldVersion: ?string,
  alwaysUpdate: ?boolean,
  snoozeTime: ?string,
  updateCommand: ?string,
  canUpdate: ?boolean
}

const initialState: ShowUpdateState = {
  started: false,
  closed: true,
  newVersion: null,
  description: null,
  type: null,
  asset: null,
  windowTitle: null,
  oldVersion: null,
  alwaysUpdate: true,
  snoozeTime: null,
  updateCommand: null,
  canUpdate: true
}

export default function (state: ShowUpdateState = initialState, action: UpdateActions): ShowUpdateState {
  switch (action.type) {
    case Constants.registerUpdateListener:
      return {
        ...state,
        started: (action.payload && action.payload.started)
      }
    case Constants.showUpdatePrompt:
      if (state.started === true && action.payload) {
        const {
          newVersion, oldVersion, description, type, asset, snoozeTime, windowTitle,
          alwaysUpdate, updateCommand, canUpdate} = action.payload

        return {
          ...state,
          closed: false,
          newVersion, oldVersion, description, type, asset, snoozeTime, windowTitle,
          alwaysUpdate, updateCommand, canUpdate
        }
      }
      return state
    case Constants.setAlwaysUpdate:
      return {
        ...state,
        alwaysUpdate: action.payload && action.payload.alwaysUpdate
      }
    case Constants.onSnooze:
      return {...state, closed: true}
    case Constants.onUpdate:
      return {...state, closed: true}
    case Constants.onCancel:
      return {...state, closed: true}
    case Constants.onSkip:
      return {...state, closed: true}
    default:
      return state
  }
}
