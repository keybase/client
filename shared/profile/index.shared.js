// @flow
import _ from 'lodash'
import {globalColors} from '../styles'
import {proveMessage} from '../util/platforms.js'
import {PlatformsExpanded} from '../constants/types/more'

import type {MissingProof} from '../common-adapters/user-proofs'
import type {Proof} from '../constants/tracker'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {Folder} from '../constants/folders'

export function folderIconProps(folder: Folder, style: ?Object = {}) {
  const type = folder.isPublic
    ? folder.hasData
        ? 'iconfont-folder-public-has-files'
        : 'iconfont-folder-public'
    : folder.hasData
        ? 'iconfont-folder-private-has-files'
        : 'iconfont-folder-private'

  const color = folder.isPublic
    ? globalColors.yellowGreen
    : globalColors.darkBlue2

  return {
    type,
    style: {...style, color},
  }
}

export function missingProofs(
  userProofs: Array<Proof>,
  onClick: (missingProof: MissingProof) => void
): Array<MissingProof> {
  let availableProofTypes = _.without(
    PlatformsExpanded,
    'http',
    'https',
    'dnsOrGenericWebSite',
    'dns'
  )
  const userProofTypes = _.chain(userProofs).map(p => p.type).uniq().value()

  const missingRegular = _.difference(
    availableProofTypes,
    userProofTypes
  ).map(type => ({type, message: proveMessage(type), onClick}))

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
