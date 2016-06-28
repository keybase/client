/* @flow */

import {globalColors, globalStyles} from '../styles/style-guide'
import {normal as proofNormal, checking as proofChecking, revoked as proofRevoked, error as proofError, warning as proofWarning} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaIgnored} from '../constants/tracker'

import type {IconType} from '../common-adapters/icon'
import type {Proof} from './user-proofs'

export function metaColor (proof: Proof): string {
  let color = globalColors.blue
  switch (proof.meta) {
    case metaNew: color = globalColors.blue; break
    case metaUpgraded: color = globalColors.blue; break
    case metaUnreachable: color = globalColors.red; break
    case metaPending: color = globalColors.black_40; break
    case metaDeleted: color = globalColors.red; break
    case metaIgnored: color = globalColors.green; break
  }
  return color
}

export function proofColor (proof: Proof): string {
  let color = globalColors.blue
  switch (proof.state) {
    case proofNormal: {
      color = proof.isTracked ? globalColors.green2 : globalColors.blue
      break
    }
    case proofChecking:
      color = globalColors.black_20
      break
    case proofRevoked:
    case proofWarning:
    case proofError:
      color = globalColors.red
      break
  }
  if (proof.state === proofChecking) color = globalColors.black_20
  return color
}

export function iconNameForProof (proof: Proof): IconType {
  const types : {[key: string]: IconType} = {
    'twitter': 'fa-kb-iconfont-identity-twitter',
    'github': 'fa-kb-iconfont-identity-github',
    'reddit': 'fa-kb-iconfont-identity-reddit',
    'pgp': 'fa-kb-iconfont-identity-pgp',
    'coinbase': 'fa-kb-iconfont-coinbase',
    'hackernews': 'fa-kb-iconfont-identity-hn',
    'rooter': 'fa-shopping-basket',
    'http': 'fa-globe',
    'https': 'fa-globe',
    'dns': 'fa-globe',
  }

  return types[proof.type]
}

export function proofStatusIcon (proof: Proof): ?IconType {
  switch (proof.state) {
    case proofChecking:
      return 'fa-kb-iconfont-proof-pending'

    case proofNormal:
      return proof.isTracked ? 'fa-kb-iconfont-proof-followed' : 'fa-kb-iconfont-proof-new'

    case proofWarning:
    case proofError:
    case proofRevoked:
      return 'fa-kb-iconfont-proof-broken'

    default:
      return null
  }
}

export function proofNameStyle (proof: Proof) {
  return {
    color: proofColor(proof),
    ...(proof.meta === metaDeleted ? globalStyles.textDecoration('line-through') : {}),
  }
}
