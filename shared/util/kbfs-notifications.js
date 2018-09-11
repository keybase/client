// @flow
import {capitalize} from 'lodash-es'
import {
  kbfsCommonFSErrorType,
  kbfsCommonFSNotificationType,
  kbfsCommonFSStatusCode,
} from '../constants/types/rpc-gen'
import path from 'path'
import {parseFolderNameToUsers} from './kbfs'
import type {FSNotification} from '../constants/types/rpc-gen'
import type {TypedState} from '../constants/reducer'

type DecodedKBFSError = {
  title: string,
  body: string,
}

function usernamesForNotification(notification: FSNotification) {
  return parseFolderNameToUsers(null, notification.filename.split(path.sep)[3] || notification.filename).map(
    i => i.username
  )
}

function tlfForNotification(notification: FSNotification): string {
  // The notification.filename is canonical platform independent path.
  // To get the TLF we can look at the first 3 directories.
  // /keybase/private/gabrielh/foo.txt => /keybase/private/gabrielh
  return notification.filename
    .split(path.sep)
    .slice(0, 4)
    .join(path.sep)
}

function decodeKBFSError(user: string, notification: FSNotification): DecodedKBFSError {
  console.log('Notification (kbfs error):', notification)
  const tlf = tlfForNotification(notification)
  switch (notification.errorType) {
    case kbfsCommonFSErrorType.accessDenied:
      let prefix = user ? `${user} does` : 'You do'
      return {
        title: 'Keybase: Access denied',
        body: `${prefix} not have ${notification.params.mode} access to ${notification.filename}`,
      }

    case kbfsCommonFSErrorType.userNotFound:
      return {
        title: 'Keybase: User not found',
        body: `${notification.params.username} is not a Keybase user`,
      }

    case kbfsCommonFSErrorType.revokedDataDetected:
      return {
        title: 'Keybase: Possibly revoked data detected',
        body: `${tlf} was modified by a revoked or bad device. Use 'keybase log send' to file an issue with the Keybase admins.`,
      }

    case kbfsCommonFSErrorType.notLoggedIn:
      return {
        title: `Keybase: Permission denied in ${tlf}`,
        body: "You are not logged into Keybase. Try 'keybase login'.",
      }

    case kbfsCommonFSErrorType.timeout:
      return {
        title: `Keybase: ${capitalize(notification.params.mode)} timeout in ${tlf}`,
        body: `The ${
          notification.params.mode
        } operation took too long and failed. Please run 'keybase log send' so our admins can review.`,
      }

    case kbfsCommonFSErrorType.rekeyNeeded:
      return notification.params.rekeyself === 'true'
        ? {
            title: 'Keybase: Files need to be rekeyed',
            body: `Please open one of your other computers to unlock ${tlf}`,
          }
        : {
            title: 'Keybase: Friends needed',
            body: `Please ask another member of ${tlf} to open Keybase on one of their computers to unlock it for you.`,
          }
    // Aggregate these cases together since they both use the usage/limit calc
    case kbfsCommonFSErrorType.overQuota:
    case kbfsCommonFSErrorType.diskLimitReached:
      const usageBytes = parseInt(notification.params.usageBytes, 10)
      const limitBytes = parseInt(notification.params.limitBytes, 10)
      const usedGB = (usageBytes / 1e9).toFixed(1)
      const usedPercent = Math.round(100 * usageBytes / limitBytes)
      if (notification.errorType === kbfsCommonFSErrorType.overQuota) {
        return {
          title: 'Keybase: Out of space',
          body: `Action needed! You are using ${usedGB}GB (${usedPercent}%) of your quota. Please delete some data.`,
        }
      } else {
        // diskLimitReached
        if (usageBytes >= 0.99 * limitBytes) {
          return {
            title: 'Keybase: Out of temporary space',
            body: `Keybase is using ${usedPercent}% of its temporary write space (${usedGB}GB), and writes will fail until the data syncs to the remote server.`,
          }
        } else {
          return {
            title: 'Keybase: Out of temporary space',
            body:
              'Keybase is using too many file system resources temporarily, and writes will fail until the data syncs to the remote server.',
          }
        }
      }

    default:
      return {
        title: 'Keybase: KBFS error',
        body: `${notification.status}`,
      }
  }

  // This code came from the kbfs team but this isn't plumbed through the protocol. Leaving this for now
  // if (notification.errorType === kbfsCommonFSErrorType.notImplemented) {
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

export function kbfsNotification(notification: FSNotification, notify: any, state: TypedState) {
  const action = {
    // For now, disable file notifications because they're really annoying and
    // we now have the syncing indicator.
    // [kbfsCommonFSNotificationType.encrypting]: 'Encrypting and uploading',
    // [kbfsCommonFSNotificationType.decrypting]: 'Decrypting',
    // [kbfsCommonFSNotificationType.signing]: 'Signing and uploading',
    // [kbfsCommonFSNotificationType.verifying]: 'Verifying and downloading',
    [kbfsCommonFSNotificationType.rekeying]: 'Rekeying',
    // The following notifications just need to be enabled, they get handled
    // independently.
    [kbfsCommonFSNotificationType.initialized]: '',
    [kbfsCommonFSNotificationType.connection]: '',
  }[notification.notificationType]

  if (action === undefined) {
    // Ignore notification types we don't care about.
    return
  }

  // KBFS fires a notification when it initializes. We prompt the user to log
  // send if there is an error.
  if (
    notification.notificationType === kbfsCommonFSNotificationType.initialized &&
    notification.statusCode === kbfsCommonFSStatusCode.error &&
    notification.errorType === kbfsCommonFSErrorType.diskCacheErrorLogSend
  ) {
    console.log(`KBFS failed to initialize its disk cache. Please send logs.`)
    let title = `KBFS: Disk cache not initialized`
    let body = `Please Send Feedback to Keybase`
    let rateLimitKey = body
    notify(title, {body}, 10, rateLimitKey)
  }

  // KBFS fires a notification when it changes state between connected
  // and disconnected (to the mdserver).  For now we just log it.
  if (notification.notificationType === kbfsCommonFSNotificationType.connection) {
    const state = notification.statusCode === kbfsCommonFSStatusCode.start ? 'connected' : 'disconnected'
    console.log(`KBFS is ${state}`)
    return
  }

  const usernames = usernamesForNotification(notification).join(' & ')

  let title = `KBFS: ${action}`
  let body = `Chat or files with ${usernames} ${notification.status}`
  let user = state.config.username
  let rateLimitKey

  const isError = notification.statusCode === kbfsCommonFSStatusCode.error
  // Don't show starting or finished, but do show error.
  if (isError) {
    if (notification.errorType === kbfsCommonFSErrorType.exdevNotSupported) {
      // Ignored for now.
      // TODO: implement the special popup window (DESKTOP-3637)
      return
    }

    ;({title, body} = decodeKBFSError(user, notification))
    rateLimitKey = body // show unique errors
  } else {
    switch (action) {
      case 'Rekeying': // limit all rekeys, no matter the tlf
        rateLimitKey = 'rekey'
        break
      default:
        rateLimitKey = usernames // by tlf
    }
  }

  notify(title, {body}, 10, rateLimitKey)
}
