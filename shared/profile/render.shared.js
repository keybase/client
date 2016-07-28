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

export function missingProofs (userProofs: Array<Proof>, onClick: (missingProof: MissingProof) => void): Array<MissingProof> {
  const availableProofTypes = ['btc'].concat(_.without(_.keys(proveCommon.ProofType), 'none', 'keybase', 'dns' /* genericWebSite is displayed instead, which should provide an option for dns once clicked */))
  const userProofTypes = _.chain(userProofs)
    .map(p => p.type)
    .map(t => _.includes(['dns', 'genericWebSite', 'http', 'https'], t) ? 'genericWebSite' : t)
    .uniq()
    .value()
  return _
    .difference(availableProofTypes, userProofTypes)
    .map(type => ({type, message: proveMessage(type), onClick}))
}
