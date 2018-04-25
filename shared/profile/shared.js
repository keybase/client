// @flow
import {without, uniq, difference} from 'lodash-es'
import {globalColors} from '../styles'
import {proveMessage} from '../util/platforms.js'
import {PlatformsExpanded} from '../constants/types/more'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/types/tracker'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {Folder} from '../constants/types/folders'

export function folderIconProps(folder: Folder, style: ?Object = {}) {
  const type = folder.isPublic ? 'iconfont-folder-public' : 'iconfont-folder-private'

  const color = folder.isPublic ? globalColors.yellowGreen : globalColors.darkBlue2

  return {
    type,
    style: {...style, color},
  }
}

export function missingProofs(
  userProofs: Array<Proof>,
  onClick: (missingProof: MissingProof) => void
): Array<MissingProof> {
  let availableProofTypes = without(PlatformsExpanded, 'http', 'https', 'dnsOrGenericWebSite', 'dns')
  const userProofTypes = uniq((userProofs || []).map(p => p.type))

  // $FlowIssue thinks its just a string
  const missingRegular = difference(availableProofTypes, userProofTypes).map((type: PlatformsExpanded) => ({
    type,
    message: proveMessage(type),
    onClick,
  }))

  // always ensure you can add a web site
  return missingRegular.concat({
    type: 'dnsOrGenericWebSite',
    message: proveMessage('dnsOrGenericWebSite'),
    onClick,
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
