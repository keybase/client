/* @flow */

import * as Constants from '../constants/update'
import engine from '../engine'
import moment from 'moment'

import {updateUi, updateCommon} from '../constants/types/keybase-v1'
import type {delegateUiCtlRegisterUpdateUIRpc, incomingCallMapType} from '../constants/types/flow-types'
import type {ShowUpdateConfirmAction, RegisterUpdateListenerAction, OnCancelAction, OnSkipAction,
  OnSnoozeAction, OnConfirmUpdateAction, SetAlwaysUpdateAction, ShowUpdatePausedAction, OnForceAction} from '../constants/update'
import type {ConfigState} from '../reducers/config'
import type {UpdateConfirmState} from '../reducers/update-confirm'
import type {UpdatePausedState} from '../reducers/update-paused'
import type {Dispatch} from '../constants/types/flux'

import {getAppPath} from '../config/config.desktop'
import {remote} from 'electron'
import path from 'path'

let updateConfirmResponse: ?{result: (payload: any) => void}
let updatePausedResponse: ?{result: (payload: any) => void}

export function registerUpdateListener (): (dispatch: Dispatch, getState: () => {config: ConfigState}) => void {
  updateConfirmResponse = null
  updatePausedResponse = null
  return (dispatch, getState) => {
    engine.listenOnConnect('registerUpdateUI', () => {
      const params : delegateUiCtlRegisterUpdateUIRpc = {
        method: 'delegateUiCtl.registerUpdateUI',
        param: {},
        incomingCallMap: {},
        callback: (error, response) => {
          if (error != null) {
            console.warn('Error in registering update ui: ', error)
          } else {
            console.log('Registered update ui')
          }
        }
      }
      engine.rpc(params)
    })

    dispatch(({
      type: Constants.registerUpdateListener,
      payload: {started: true}
    }: RegisterUpdateListenerAction))

    const listeners = updateListenersCreator(dispatch, getState)
    engine.listenGeneralIncomingRpc(listeners)
  }
}

function updateListenersCreator (dispatch: Dispatch, getState: () => {config: ConfigState}): incomingCallMapType {
  return {
    'keybase.1.updateUi.updatePrompt': (payload, response) => {
      console.log('Update (prompt)')

      updateConfirmResponse = response
      const {version, description, instructions, type, asset} = payload.update
      const {alwaysAutoInstall} = payload.options

      const windowTitle = {
        [updateCommon.UpdateType.normal]: 'Update: Version ' + version,
        [updateCommon.UpdateType.bugfix]: 'Update: Version ' + version,
        [updateCommon.UpdateType.critical]: 'Critical Update: Version ' + version
      }[type]

      let oldVersion = ''
      let config = getState().config
      if (config != null) {
        config = config.config
        if (config != null) {
          oldVersion = config.version
        }
      }

      const updateCommand = (instructions && instructions.length) ? instructions : null

      // Cancel any existing update prompts; this will trigger a new focused window
      dispatch({
        type: Constants.onCancel,
        payload: null
      })

      dispatch(({
        type: Constants.showUpdateConfirm,
        payload: {
          isCritical: type === updateCommon.UpdateType.critical,
          newVersion: version,
          description,
          type,
          asset,
          snoozeTime: moment.duration(Constants.snoozeTimeSecs, 'seconds').humanize(),
          windowTitle,
          oldVersion,
          alwaysUpdate: alwaysAutoInstall,
          updateCommand,
          canUpdate: !updateCommand
        }
      }: ShowUpdateConfirmAction))
    },

    'keybase.1.updateUi.updateAppInUse': (payload, response) => {
      console.log('Update (app in use) prompt')

      updatePausedResponse = response

      // Cancel any existing update prompts
      dispatch({
        type: Constants.onCancel,
        payload: null
      })

      dispatch(({
        type: Constants.showUpdatePaused,
        payload: {
        }
      }: ShowUpdatePausedAction))
    },

    'keybase.1.updateUi.updateQuit': (payload, response) => {
      console.log('Update (quit/restart)')

      let errored = false
      let quit = false
      let applicationPath = ''
      if (payload.status) {
        const {code, desc} = payload.status
        errored = (code > 0)
        if (errored) {
          remote.dialog.showErrorBox('Keybase Update Error', `There was an error trying to update; ${desc} (${code})`)
        }
      }

      if (!errored) {
        const appPath = getAppPath()

        // This returns the app bundle path on OS X in production mode.
        // TODO: Find a better, cross-platform way of resolving the real app path.
        applicationPath = path.resolve(appPath, '..', '..', '..')
        if (path.basename(applicationPath) === 'Keybase.app') {
          quit = true
        }
      }

      response.result({
        quit,
        pid: remote.process.pid,
        applicationPath: applicationPath
      })
    }
  }
}

function sendUpdateConfirmResponse (payload: any /* UpdatePromptRes */): void {
  if (!updateConfirmResponse) {
    console.warn('Update confirm response with incorrect flow')
    return
  }

  updateConfirmResponse.result(payload)
  updateConfirmResponse = null
}

export function onCancel (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onCancel, payload: null}: OnCancelAction))
    sendUpdateConfirmResponse({action: updateUi.UpdateAction.cancel})
  }
}

export function onSkip (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onSkip, payload: null}: OnSkipAction))
    sendUpdateConfirmResponse({action: updateUi.UpdateAction.skip})
  }
}

export function onSnooze (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onSnooze, payload: null}: OnSnoozeAction))
    sendUpdateConfirmResponse({
      action: updateUi.UpdateAction.snooze,
      snoozeUntil: Date.now() + Constants.snoozeTimeSecs * 1000
    })
  }
}

export function onUpdate (): (dispatch: Dispatch, getState: () => {updateConfirm: UpdateConfirmState}) => void {
  return (dispatch, getState) => {
    dispatch(({type: Constants.onConfirmUpdate, payload: null}: OnConfirmUpdateAction))
    sendUpdateConfirmResponse({
      action: updateUi.UpdateAction.update,
      alwaysAutoInstall: getState().updateConfirm.alwaysUpdate
    })
  }
}

export function setAlwaysUpdate (alwaysUpdate: bool): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({
      type: Constants.setAlwaysUpdate,
      payload: {
        alwaysUpdate
      }
    }: SetAlwaysUpdateAction))
  }
}

export function onForce (): (dispatch: Dispatch, getState: () => {updatePaused: UpdatePausedState}) => void {
  return (dispatch, getState) => {
    dispatch(({type: Constants.onForce, payload: null}: OnForceAction))
    sendUpdatePausedResponse({
      action: updateUi.UpdateAppInUseAction.force
    })
  }
}

export function onPauseCancel (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onCancel, payload: null}: OnCancelAction))
    sendUpdatePausedResponse({action: updateUi.UpdateAppInUseAction.cancel})
  }
}

function sendUpdatePausedResponse (payload: any /* UpdatePromptRes */): void {
  if (!updatePausedResponse) {
    console.warn('Update paused response with incorrect flow')
    return
  }

  updatePausedResponse.result(payload)
  updatePausedResponse = null
}
