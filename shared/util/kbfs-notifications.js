/* @flow */

import _ from 'lodash'
import {kbfsCommon} from '../constants/types/keybase-v1'
import {getTLF} from '../util/kbfs'
import path from 'path'
import type {FSNotification} from '../constants/types/flow-types'

type DecodedKBFSError = {
  'title': string;
  'body': string;
}

export function decodeKBFSError (user: string, notification: FSNotification): DecodedKBFSError {
  const basedir = notification.filename.split(path.sep)[0]
  const tlf = `/keybase${getTLF(notification.publicTopLevelFolder, basedir)}`
  const errors = {
    [kbfsCommon.FSErrorType.accessDenied]: {
      title: 'Keybase: Access denied',
      body: `${user} does not have ${notification.params.mode} access to ${tlf}`
    },
    [kbfsCommon.FSErrorType.userNotFound]: {
      title: 'Keybase: User not found',
      body: `${notification.params.username} is not a Keybase user`
    },
    [kbfsCommon.FSErrorType.revokedDataDetected]: {
      title: 'Keybase: Possibly revoked data detected',
      body: `${tlf} was modified by a revoked or bad device. Use 'keybase log send' to file an issue with the Keybase admins.`
    },
    [kbfsCommon.FSErrorType.notLoggedIn]: {
      title: `Keybase: Permission denied in ${tlf}`,
      body: "You are not logged into Keybase. Try 'keybase login'."
    },
    [kbfsCommon.FSErrorType.timeout]: {
      title: `Keybase: ${_.capitalize(notification.params.mode)} timeout in ${tlf}`,
      body: `The ${notification.params.mode} operation took too long and failed. Please run 'keybase log send' so our admins can review.`
    },
    [kbfsCommon.FSErrorType.rekeyNeeded]: notification.params.rekeyself ? {
      title: 'Keybase: Files need to be rekeyed',
      body: `Please open one of your other computers to unlock ${tlf}`
    } : {
      title: 'Keybase: Friends needed',
      body: `Please ask another member of ${tlf} to open Keybase on one of their computers to unlock it for you.`
    },
    [kbfsCommon.FSErrorType.badFolder]: {
      title: 'Keybase: Bad folder',
      body: `${notification.params.tlf} is not a Keybase folder. All folders begin with /keybase/private or /keybase/public.`
    }
  }

  if (notification.errorType in errors) {
    return errors[notification.errorType]
  }

  return ({
    title: 'Keybase: KBFS error',
    body: `${notification.status}`
  })

  // This code came from the kbfs team but this isn't plumbed through the protocol. Leaving this for now
  // if (notification.errorType === kbfsCommon.FSErrorType.notImplemented) {
    // if (notification.feature === '2gbFileLimit') {
      // return ({
        // title: 'Keybase: Not yet implemented',
        // body: `You just tried to write a file larger than 2GB in ${tlf}. This limitation will be removed soon.`
      // })
    // } else if (notification.feature === '512kbDirLimit') {
      // return ({
        // title: 'Keybase: Not yet implemented',
        // body: `You just tried to write too many files into ${tlf}. This limitation will be removed soon.`
      // })
    // } else {
      // return ({
        // title: 'Keybase: Not yet implemented',
        // body: `You just hit a ${notification.feature} limitation in KBFS. It will be fixed soon.`
      // })
    // }
  // } else {
    // return ({
      // title: 'Keybase: KBFS error',
      // body: `${notification.status}`
    // })
  // }
}

// TODO: Once we have access to the Redux store from the thread running
// notification listeners, store the sentNotifications map in it.
var sentNotifications = {}

export function kbfsNotification (notification: FSNotification, notify: any, getState: any) {
  const action = {
    [kbfsCommon.FSNotificationType.encrypting]: 'Encrypting and uploading',
    [kbfsCommon.FSNotificationType.decrypting]: 'Decrypting, verifying, and downloading',
    [kbfsCommon.FSNotificationType.signing]: 'Signing and uploading',
    [kbfsCommon.FSNotificationType.verifying]: 'Verifying and downloading',
    [kbfsCommon.FSNotificationType.rekeying]: 'Rekeying'
  }[notification.notificationType]

  if (action === undefined) {
    // Ignore notification types we don't care about.
    return
  }

  const state = {
    [kbfsCommon.FSStatusCode.start]: 'starting',
    [kbfsCommon.FSStatusCode.finish]: 'finished',
    [kbfsCommon.FSStatusCode.error]: 'errored'
  }[notification.statusCode]

  // KBFS fires a notification when it changes state between connected
  // and disconnected (to the mdserver).  For now we just log it.
  if (notification.notificationType === kbfsCommon.FSNotificationType.connection) {
    const state = (notification.statusCode === kbfsCommon.FSStatusCode.start) ? 'connected' : 'disconnected'
    console.log(`KBFS is ${state}`)
    return
  }

  if (notification.statusCode === kbfsCommon.FSStatusCode.finish) {
    // Since we're aggregating dir operations and not showing state,
    // let's ignore file-finished notifications.
    return
  }

  const basedir = notification.filename.split(path.sep)[0]
  const tlf = getTLF(notification.publicTopLevelFolder, basedir)

  let title = `KBFS: ${action}`
  let body = `Files in ${tlf} ${notification.status}`
  let user = 'You' || getState().config.username
  // Don't show starting or finished, but do show error.
  if (notification.statusCode === kbfsCommon.FSStatusCode.error) {
    ({title, body} = decodeKBFSError(user, notification))
  }

  function rateLimitAllowsNotify (action, state, tlf) {
    if (!(action in sentNotifications)) {
      sentNotifications[action] = {}
    }
    if (!(state in sentNotifications[action])) {
      sentNotifications[action][state] = {}
    }

    // 20s in msec
    const delay = 20000
    const now = new Date()

    // If we haven't notified for {action,state,tlf} or it was >20s ago, do it.
    if (!(tlf in sentNotifications[action][state]) || now - sentNotifications[action][state][tlf] > delay) {
      sentNotifications[action][state][tlf] = now
      return true
    }

    // We've already notified recently, ignore this one.
    return false
  }

  if (rateLimitAllowsNotify(action, state, tlf)) {
    notify(title, {body})
  }
}
