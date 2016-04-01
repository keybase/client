/* @flow */

import _ from 'lodash'
import enums from '../constants/types/keybase-v1'
import path from 'path'
import type {FSNotification} from '../constants/types/flow-types'

// Parses the folder name and returns an array of usernames (TODO: handle read only-ers)
export function parseFolderNameToUsers (folderName: string): Array<string> {
  return folderName.split(',')
}

// Make sure the given username is at the front of the array.
// To fit our canonical representation of foldernames (yourself being in the front)
export function canonicalizeUsernames (username: string, usernames: Array<string>): Array<string> {
  return [].concat(usernames.filter(u => u === username), usernames.filter(u => u !== username))
}

export function stripPublicTag (folderName: string): string {
  return folderName.replace('#public', '')
}

export function getTLF (isPublic: boolean, basedir: string): string {
  if (isPublic) {
    // Public filenames look like cjb#public/foo.txt
    return `/public/${stripPublicTag(basedir)}`
  } else {
    // Private filenames look like cjb/foo.txt
    return `/private/${basedir}`
  }
}

export function cleanup (folderName: string): string {
  if (!folderName) {
    return ''
  }

  return folderName.replace(/\s/g, '').replace(/\.\./g, '').replace(/\//g, '').replace(/\\/g, '')
}

export function decodeKBFSError (user: string, notification: FSNotification): Array<string> {
  const basedir = notification.filename.split(path.sep)[0]
  const tlf = `/keybase${getTLF(notification.publicTopLevelFolder, basedir)}`
  const errors = {
    [enums.kbfs.FSErrorType.accessDenied]: [
      'Keybase: Access denied',
      `${user} does not have ${notification.params.mode} access to ${tlf}`
    ],
    [enums.kbfs.FSErrorType.userNotFound]: [
      'Keybase: User not found',
      `${notification.params.username} is not a Keybase user`
    ],
    [enums.kbfs.FSErrorType.revokedDataDetected]: [
      'Keybase: Possibly revoked data detected',
      `${tlf} was modified by a revoked or bad device. Use 'keybase log send' to file an issue with the Keybase admins.`
    ],
    [enums.kbfs.FSErrorType.notLoggedIn]: [
      `Keybase: Permission denied in ${tlf}`,
      "You are not logged into Keybase. Try 'keybase login'."
    ],
    [enums.kbfs.FSErrorType.timeout]: [
      `Keybase: ${_.capitalize(notification.params.mode)} timeout in ${tlf}`,
      `The ${notification.params.mode} operation took too long and failed. Please run 'keybase log send' so our admins can review.`
    ],
    [enums.kbfs.FSErrorType.rekeyNeeded]: notification.rekeyself ? [
      'Keybase: Files need to be rekeyed',
      `Please open one of your other computers to unlock ${tlf}`
    ] : [
      'Keybase: Friends needed',
      `Please ask another member of ${tlf} to open Keybase on one of their computers to unlock it for you.`
    ],
    [enums.kbfs.FSErrorType.badFolder]: [
      'Keybase: Bad folder',
      `${tlf} is not a Keybase folder. All folders begin with /keybase/private or /keybase/public.`
    ]
  }

  if (notification.errorType in errors) {
    return errors[notification.errorType]
  }

  if (notification.errorType === enums.kbfs.FSErrorType.notImplemented) {
    if (notification.feature === '2gbFileLimit') {
      return ([
        'Keybase: Not yet implemented',
        `You just tried to write a file larger than 2GB in ${tlf}. This limitation will be removed soon.`
      ])
    } else if (notification.feature === '512kbDirLimit') {
      return ([
        'Keybase: Not yet implemented',
        `You just tried to write too many files into ${tlf}. This limitation will be removed soon.`
      ])
    } else {
      return ([
        'Keybase: Not yet implemented',
        `You just hit a ${notification.feature} limitation in KBFS. It will be fixed soon.`
      ])
    }
  } else {
    return ([
      'Keybase: KBFS error',
      `${notification.status}`
    ])
  }
}
