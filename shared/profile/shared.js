// @flow
import {without, uniq, difference} from 'lodash-es'
import {globalColors} from '../styles'
import {proveMessage} from '../util/platforms'
import {PlatformsExpanded} from '../constants/types/more'

import type {MissingProof} from './user-proofs'
import type {Proof} from '../constants/types/tracker'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {Folder} from '../constants/types/folders'

export function folderIconType(folder: Folder) {
  return folder.isPublic ? 'iconfont-folder-public' : 'iconfont-folder-private'
}

export function folderIconColor(folder: Folder) {
  return folder.isPublic ? globalColors.yellowGreen : globalColors.darkBlue2
}

export function missingProofs(
  userProofs: Array<Proof>,
  onClick: (missingProof: MissingProof) => void
): Array<MissingProof> {
  let availableProofTypes = without(
    PlatformsExpanded,
    'http',
    'https',
    'web',
    'dnsOrGenericWebSite',
    'dns',
    // FB removed on purpose
    'facebook'
  )
  const userProofTypes = uniq((userProofs || []).map(p => p.type))

  // $FlowIssue thinks its just a string
  const missingRegular = difference(availableProofTypes, userProofTypes).map((type: PlatformsExpanded) => ({
    message: proveMessage(type),
    onClick,
    type,
  }))

  // always ensure you can add a web site
  return missingRegular.concat({
    message: proveMessage('dnsOrGenericWebSite'),
    onClick,
    type: 'dnsOrGenericWebSite',
  })
}

export function revokeProofLanguage(platform: PlatformsExpandedType) {
  let msg
  switch (platform) {
    case 'pgp':
      msg = 'Drop key'
      break
    default:
      msg = 'Revoke'
  }
  return msg
}
