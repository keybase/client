import _ from 'lodash'
import {globalColors} from '../styles/style-guide'
import type {Proof, MissingProof} from './render'
import {proveCommon} from '../constants/types/keybase-v1'
import {proveMessage} from '../util/platforms.js'

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

export function missingProofs (userProofs: Array<Proof>, onClick: (proof: MissingProof) => void): Array<MissingProof> {
  const availableProofs = ['btc'].concat(_.without(_.keys(proveCommon.ProofType), 'none', 'keybase', 'dns'))
    .map(type => ({type, message: proveMessage(type), onClick}))
  const userProofTypes = userProofs.map(p => p.type)
  const missingProofs = availableProofs.filter(ap => userProofTypes.indexOf(ap.type) === -1)
  if (['dns', 'genericWebSite', 'http', 'https'].some(t => _.includes(userProofTypes, t))) {
    return missingProofs.filter(mp => !_.includes(['dns', 'genericWebSite'], mp.type))
  }
  return missingProofs
}
