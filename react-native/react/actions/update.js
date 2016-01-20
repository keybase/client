/* @flow */

import * as Constants from '../constants/update'
import engine from '../engine'
import moment from 'moment'

import {updateUi} from '../constants/types/keybase_v1'
import type {Update} from '../constants/types/flow-types'
import type {ShowUpdateAction, RegisterUpdateListenerAction, OnCancelAction, OnSkipAction, OnSnoozeAction, OnUpdateAction, SetAlwaysUpdateAction} from '../constants/update'
import type {ConfigState} from '../reducers/config'
import type {ShowUpdateState} from '../reducers/update'
import {snoozeTimeSecs} from '../constants/update'
import type {Dispatch} from '../constants/types/flux'

import {remote} from 'electron'
import path from 'path'

let updatePromptResponse: ?{result: (payload: any) => void}

export function registerUpdateListener (): (dispatch: Dispatch, getState: () => {config: ConfigState}) => void {
  updatePromptResponse = null
  return (dispatch, getState) => {
    engine.listenOnConnect('registerUpdateUI', () => {
      engine.rpc('delegateUiCtl.registerUpdateUI', {}, {}, (error, response) => {
        if (error != null) {
          console.error('error in registering update ui: ', error)
        } else {
          console.log('Registered update ui')
        }
      })
    })

    dispatch(({
      type: Constants.registerUpdateListener,
      payload: {started: true}
    }: RegisterUpdateListenerAction))

    const listeners = updateListenersCreator(dispatch, getState)
    Object.keys(listeners).forEach(
      k => engine.listenGeneralIncomingRpc(k, listeners[k])
    )
  }
}

function updateListenersCreator (dispatch: Dispatch, getState: () => {config: ConfigState}) {
  return {
    'keybase.1.updateUi.updatePrompt': (payload: {update: Update}, response) => {
      console.log('Asked for update prompt')

      updatePromptResponse = response
      const {version, description, type, asset} = payload.update

      const windowTitle = {
        [updateUi.UpdateType.normal]: 'Keybase Update',
        [updateUi.UpdateType.bugfix]: 'Keybase Update',
        [updateUi.UpdateType.critical]: 'Critical Keybase Update'
      }[type]

      let oldVersion = ''
      let config = getState().config
      if (config != null) {
        config = config.config
        if (config != null) {
          oldVersion = config.version
        }
      }
      const updateCommand = ['darwin', 'win32'].indexOf(process.platform) === -1 ? 'TODO get this from server' : null

      dispatch(({
        type: Constants.showUpdatePrompt,
        payload: {
          isCritical: type === updateUi.UpdateType.critical,
          newVersion: version,
          description,
          type,
          asset,
          snoozeTime: moment.duration(snoozeTimeSecs, 'seconds').humanize(),
          windowTitle,
          oldVersion,
          alwaysUpdate: false,
          updateCommand,
          canUpdate: !updateCommand
        }
      }: ShowUpdateAction))
    },

    'keybase.1.updateUi.updateQuit': (param, response) => {
      const appPath = remote.app.getAppPath()

      // This returns the app bundle path on OS X in production mode.
      // TODO: Find a better, cross-platform way of resolving the real app path.
      const applicationPath = path.resolve(appPath, '..', '..', '..')
      var quit = false
      if (path.basename(applicationPath) === 'Keybase.app') {
        quit = true
      }

      response.result({
        quit,
        pid: remote.process.pid,
        applicationPath: applicationPath
      })
    }
  }
}

function sendUpdatePromptResponse (payload: any /* UpdatePromptRes */): void {
  if (!updatePromptResponse) {
    console.error('Update send response with incorrect flow')
    return
  }

  updatePromptResponse.result(payload)
  updatePromptResponse = null
}

export function onCancel (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onCancel}: OnCancelAction))
    sendUpdatePromptResponse({action: updateUi.UpdateAction.cancel})
  }
}

export function onSkip (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onSkip}: OnSkipAction))
    sendUpdatePromptResponse({action: updateUi.UpdateAction.skip})
  }
}

export function onSnooze (): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch(({type: Constants.onSnooze}: OnSnoozeAction))
    sendUpdatePromptResponse({
      action: updateUi.UpdateAction.snooze,
      snoozeUntil: Date.now() + snoozeTimeSecs * 1000
    })
  }
}

export function onUpdate (): (dispatch: Dispatch, getState: () => {update: ShowUpdateState}) => void {
  return (dispatch, getState) => {
    dispatch(({type: Constants.onUpdate}: OnUpdateAction))
    sendUpdatePromptResponse({
      action: updateUi.UpdateAction.update,
      alwaysAutoInstall: getState().update.alwaysUpdate
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
