// @flow
import _ from 'lodash'
import {KbfsCommonFSErrorType, KbfsCommonFSNotificationType, KbfsCommonFSStatusCode} from '../constants/types/flow-types'
import {getTLF} from '../util/kbfs'
import path from 'path'
import type {FSNotification} from '../constants/types/flow-types'

type DecodedKBFSError = {
  'title': string,
  'body': string,
}

function tlfForNotification (notification: FSNotification): string {
  // The notification.filename is canonical platform independent path.
  // To get the TLF we can look at the first 3 directories.
  // /keybase/private/gabrielh/foo.txt => /keybase/private/gabrielh
  return notification.filename.split(path.sep).slice(0, 4).join(path.sep)
}

export function decodeKBFSError (user: string, notification: FSNotification): DecodedKBFSError {
  console.log('Notification (kbfs error):', notification)
  const tlf = tlfForNotification(notification)
  switch (notification.errorType) {
    case KbfsCommonFSErrorType.accessDenied:
      let prefix = user ? `${user} does` : 'You do'
      return {
        title: 'Keybase: Access denied',
        body: `${prefix} not have ${notification.params.mode} access to ${notification.filename}`,
      }

    case KbfsCommonFSErrorType.userNotFound:
      return {
        title: 'Keybase: User not found',
        body: `${notification.params.username} is not a Keybase user`,
      }

    case KbfsCommonFSErrorType.revokedDataDetected:
      return {
        title: 'Keybase: Possibly revoked data detected',
        body: `${tlf} was modified by a revoked or bad device. Use 'keybase log send' to file an issue with the Keybase admins.`,
      }

    case KbfsCommonFSErrorType.notLoggedIn:
      return {
        title: `Keybase: Permission denied in ${tlf}`,
        body: "You are not logged into Keybase. Try 'keybase login'.",
      }

    case KbfsCommonFSErrorType.timeout:
      return {
        title: `Keybase: ${_.capitalize(notification.params.mode)} timeout in ${tlf}`,
        body: `The ${notification.params.mode} operation took too long and failed. Please run 'keybase log send' so our admins can review.`,
      }

    case KbfsCommonFSErrorType.rekeyNeeded:
      return notification.params.rekeyself === 'true' ? {
        title: 'Keybase: Files need to be rekeyed',
        body: `Please open one of your other computers to unlock ${tlf}`,
      } : {
        title: 'Keybase: Friends needed',
        body: `Please ask another member of ${tlf} to open Keybase on one of their computers to unlock it for you.`,
      }

    case KbfsCommonFSErrorType.overQuota:
      const usageBytes = parseInt(notification.params.usageBytes, 10)
      const limitBytes = parseInt(notification.params.limitBytes, 10)
      const usedGB = (usageBytes / 1e9).toFixed(1)
      const usedPercent = Math.round(100 * usageBytes / limitBytes)
      return {
        title: 'Keybase: Out of space',
        body: `Action needed! You are using ${usedGB}GB (${usedPercent}%) of your quota. Please delete some data.`,
      }

    default:
      return {
        title: 'Keybase: KBFS error',
        body: `${notification.status}`,
      }
  }

  // This code came from the kbfs team but this isn't plumbed through the protocol. Leaving this for now
  // if (notification.errorType === KbfsCommonFSErrorType.notImplemented) {
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
let sentNotifications = {}
let sentError = null
function rateLimitAllowsNotify (action, state, tlf, isError) {
  if (!(action in sentNotifications)) {
    sentNotifications[action] = {}
  }
  if (!(state in sentNotifications[action])) {
    sentNotifications[action][state] = {}
  }

  const now = new Date()

  // If we haven't notified for {action,state,tlf} or it was >20s ago, do it.
  const MSG_DELAY = 20 * 1000
  if (tlf in sentNotifications[action][state] && now - sentNotifications[action][state][tlf] <= MSG_DELAY) {
    return false
  }

  // If we last displayed an error, don't replace it with another notification for 5s.
  const ERROR_DELAY = 5 * 1000
  if (sentError !== null && now - sentError <= ERROR_DELAY) {
    return false
  }

  sentNotifications[action][state][tlf] = now
  if (isError) {
    sentError = now
  }

  return true
}

export function kbfsNotification (notification: FSNotification, notify: any, getState: any) {
  const action = {
    [KbfsCommonFSNotificationType.encrypting]: 'Encrypting and uploading',
    [KbfsCommonFSNotificationType.decrypting]: 'Decrypting',
    [KbfsCommonFSNotificationType.signing]: 'Signing and uploading',
    [KbfsCommonFSNotificationType.verifying]: 'Verifying and downloading',
    [KbfsCommonFSNotificationType.rekeying]: 'Rekeying',
  }[notification.notificationType]

  if (action === undefined) {
    // Ignore notification types we don't care about.
    return
  }

  const state = {
    [KbfsCommonFSStatusCode.start]: 'starting',
    [KbfsCommonFSStatusCode.finish]: 'finished',
    [KbfsCommonFSStatusCode.error]: 'errored',
  }[notification.statusCode]

  // KBFS fires a notification when it changes state between connected
  // and disconnected (to the mdserver).  For now we just log it.
  if (notification.notificationType === KbfsCommonFSNotificationType.connection) {
    const state = (notification.statusCode === KbfsCommonFSStatusCode.start) ? 'connected' : 'disconnected'
    console.log(`KBFS is ${state}`)
    return
  }

  if (notification.statusCode === KbfsCommonFSStatusCode.finish) {
    // Since we're aggregating dir operations and not showing state,
    // let's ignore file-finished notifications.
    return
  }

  const tlf = tlfForNotification(notification)

  let title = `KBFS: ${action}`
  let body = `Files in ${tlf} ${notification.status}`
  let user = getState().config.username

  const isError = notification.statusCode === KbfsCommonFSStatusCode.error
  // Don't show starting or finished, but do show error.
  if (isError) {
    ({title, body} = decodeKBFSError(user, notification))
  }

  if (rateLimitAllowsNotify(action, state, tlf, isError)) {
    notify(title, {body})
  }
}
