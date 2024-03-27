import {pathSep} from '@/constants/platform'
import {_useState as useCurrentUserState} from '@/constants/current-user'
import capitalize from 'lodash/capitalize'
import * as T from '@/constants/types'
import {parseFolderNameToUsers} from '@/util/kbfs'

type DecodedKBFSError = {
  title: string
  body: string
}

function usernamesForNotification(notification: T.RPCGen.FSNotification) {
  return parseFolderNameToUsers(
    undefined,
    notification.filename.split(pathSep)[3] || notification.filename
  ).map(i => i.username)
}

function tlfForNotification(notification: T.RPCGen.FSNotification): string {
  // The notification.filename is canonical platform independent path.
  // To get the TLF we can look at the first 3 directories.
  // /keybase/private/gabrielh/foo.txt => /keybase/private/gabrielh
  return notification.filename.split(pathSep).slice(0, 4).join(pathSep)
}

function decodeKBFSError(user: string, notification: T.RPCGen.FSNotification): DecodedKBFSError {
  console.log('Notification (kbfs error):', notification)
  const tlf = tlfForNotification(notification)
  switch (notification.errorType) {
    case T.RPCGen.FSErrorType.accessDenied: {
      const prefix = user ? `${user} does` : 'You do'
      return {
        body: `${prefix} not have ${notification.params?.['mode'] ?? ''} access to ${notification.filename}`,
        title: 'Keybase: Access denied',
      }
    }

    case T.RPCGen.FSErrorType.userNotFound:
      return {
        body: `${notification.params?.['username'] ?? ''} is not a Keybase user`,
        title: 'Keybase: User not found',
      }

    case T.RPCGen.FSErrorType.revokedDataDetected:
      return {
        body: `${tlf} was modified by a revoked or bad device. Use 'keybase log send' to file an issue with the Keybase admins.`,
        title: 'Keybase: Possibly revoked data detected',
      }

    case T.RPCGen.FSErrorType.notLoggedIn:
      return {
        body: "You are not logged into Keybase. Try 'keybase login'.",
        title: `Keybase: Permission denied in ${tlf}`,
      }

    case T.RPCGen.FSErrorType.timeout:
      return {
        body: `The ${
          notification.params?.['mode'] ?? ''
        } operation took too long and failed. Please run 'keybase log send' so our admins can review.`,
        title: `Keybase: ${capitalize(notification.params?.['mode'] ?? '')} timeout in ${tlf}`,
      }

    case T.RPCGen.FSErrorType.rekeyNeeded:
      return notification.params?.['rekeyself'] === 'true'
        ? {
            body: `Please open one of your other computers to unlock ${tlf}`,
            title: 'Keybase: Files need to be rekeyed',
          }
        : {
            body: `Please ask another member of ${tlf} to open Keybase on one of their computers to unlock it for you.`,
            title: 'Keybase: Friends needed',
          }
    // Aggregate these cases together since they both use the usage/limit calc
    case T.RPCGen.FSErrorType.overQuota:
    case T.RPCGen.FSErrorType.diskLimitReached: {
      const usageBytes = parseInt(notification.params?.['usageBytes'] ?? '', 10)
      const limitBytes = parseInt(notification.params?.['limitBytes'] ?? '', 10)
      const usedGB = (usageBytes / 1e9).toFixed(1)
      const usedPercent = Math.round((100 * usageBytes) / limitBytes)
      if (notification.errorType === T.RPCGen.FSErrorType.overQuota) {
        return {
          body: `Action needed! You are using ${usedGB}GB (${usedPercent}%) of your quota. Please delete some data.`,
          title: 'Keybase: Out of space',
        }
      } else {
        // diskLimitReached
        if (usageBytes >= 0.99 * limitBytes) {
          return {
            body: `Keybase is using ${usedPercent}% of its temporary write space (${usedGB}GB), and writes will fail until the data syncs to the remote server.`,
            title: 'Keybase: Out of temporary space',
          }
        } else {
          return {
            body: 'Keybase is using too many file system resources temporarily, and writes will fail until the data syncs to the remote server.',
            title: 'Keybase: Out of temporary space',
          }
        }
      }
    }
    case T.RPCGen.FSErrorType.offlineArchived:
      return {
        body: `You cannot browse archived KBFS data while disconnected from the Keybase servers.`,
        title: 'Keybase: Archived data not available offline',
      }
    case T.RPCGen.FSErrorType.offlineUnsynced:
      return {
        body: `You cannot browse an unsynced folder while disconnected from the Keybase servers.`,
        title: 'Keybase: Unsynced data not available offline',
      }

    default:
      return {
        body: `${notification.status}`,
        title: 'Keybase: KBFS error',
      }
  }

  // This code came from the kbfs team but this isn't plumbed through the protocol. Leaving this for now
  // if (notification.errorType === FSErrorType.notImplemented) {
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

export function kbfsNotification(
  notification: T.RPCGen.FSNotification,
  notify: (
    title: string,
    opts?: {body?: string; sound?: boolean},
    rateLimitSeconds?: number,
    rateLimitKey?: string,
    onClick?: () => void,
    onClose?: () => void
  ) => void
) {
  const action = (
    {
      // For now, disable file notifications because they're really annoying and
      // we now have the syncing indicator.
      // [FSNotificationType.encrypting]: 'Encrypting and uploading',
      // [FSNotificationType.decrypting]: 'Decrypting',
      // [FSNotificationType.signing]: 'Signing and uploading',
      // [FSNotificationType.verifying]: 'Verifying and downloading',
      [T.RPCGen.FSNotificationType.rekeying]: 'Rekeying',
      // The following notifications just need to be enabled, they get handled
      // independently.
      [T.RPCGen.FSNotificationType.initialized]: '',
      [T.RPCGen.FSNotificationType.connection]: '',
      // [FSNotificationType.syncConfigChanged]: 'Synchronization config changed',
    } as any
  )[notification.notificationType] as string | undefined

  if (action === undefined && notification.statusCode !== T.RPCGen.FSStatusCode.error) {
    // Ignore notification types we don't care about.
    return
  }

  // KBFS fires a notification when it initializes. We prompt the user to log
  // send if there is an error.
  if (
    notification.notificationType === T.RPCGen.FSNotificationType.initialized &&
    notification.statusCode === T.RPCGen.FSStatusCode.error &&
    notification.errorType === T.RPCGen.FSErrorType.diskCacheErrorLogSend
  ) {
    console.log(`KBFS failed to initialize its disk cache. Please send logs.`)
    const title = `KBFS: Disk cache not initialized`
    const body = `Please Send Feedback to Keybase`
    const rateLimitKey = body
    notify(title, {body}, 10, rateLimitKey)
  }

  // KBFS fires a notification when it changes state between connected
  // and disconnected (to the mdserver).  For now we just log it.
  if (notification.notificationType === T.RPCGen.FSNotificationType.connection) {
    const state = notification.statusCode === T.RPCGen.FSStatusCode.start ? 'connected' : 'disconnected'
    console.log(`KBFS is ${state}`)
    return
  }

  const usernames = usernamesForNotification(notification).join(' & ')

  let title = `KBFS: ${action}`
  let body = `Chat or files with ${usernames} ${notification.status}`
  const user = useCurrentUserState.getState().username
  let rateLimitKey: string

  const isError = notification.statusCode === T.RPCGen.FSStatusCode.error
  // Don't show starting or finished, but do show error.
  if (isError) {
    if (notification.errorType === T.RPCGen.FSErrorType.exdevNotSupported) {
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
