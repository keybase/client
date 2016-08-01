import _ from 'lodash'
import {globalColors} from '../styles/style-guide'
import type {Proof, MissingProof} from './render'
import {proveMessage} from '../util/platforms.js'
import {PlatformsExpanded} from '../constants/types/more'

export function folderIconProps (folder, style = {}) {
  const type = folder.isPublic
    ? (folder.hasData ? 'iconfont-folder-public-has-files' : 'iconfont-folder-public')
    : (folder.hasData ? 'iconfont-folder-private-has-files' : 'iconfont-folder-private')

  const color = folder.isPublic
    ? globalColors.yellowGreen
    : globalColors.darkBlue2

  return {
    type,
    style: {...style, color},
  }
}

export function missingProofs (userProofs: Array<Proof>, onClick: (missingProof: MissingProof) => void): Array<MissingProof> {
  const availableProofTypes = _.without(PlatformsExpanded, 'http', 'https', 'dnsOrGenericWebSite', 'dns')
  const userProofTypes = _.chain(userProofs)
    .map(p => p.type)
    .uniq()
    .value()

  const missingRegular = _
    .difference(availableProofTypes, userProofTypes)
    .map(type => ({type, message: proveMessage(type), onClick}))

  // always ensure you can add a web site
  return missingRegular.concat({type: 'dnsOrGenericWebSite', message: proveMessage('dnsOrGenericWebSite'), onClick})
}
