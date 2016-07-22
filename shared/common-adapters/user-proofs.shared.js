/* @flow */

import {globalColors, globalStyles} from '../styles/style-guide'
import {normal as proofNormal, checking as proofChecking, revoked as proofRevoked, error as proofError, warning as proofWarning,
  metaNew, metaUpgraded, metaUnreachable, metaPending, metaDeleted, metaIgnored} from '../constants/tracker'
import type {PlatformsExpanded} from '../constants/types/more.js'

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

export function iconNameForProof ({type}: {type: PlatformsExpanded}): IconType {
  const types = {
    'none': 'iconfont-close',
    'keybase': 'iconfont-close',
    'twitter': 'iconfont-identity-twitter',
    'github': 'iconfont-identity-github',
    'reddit': 'iconfont-identity-reddit',
    'pgp': 'iconfont-identity-pgp',
    'coinbase': 'iconfont-coinbase',
    'hackernews': 'iconfont-identity-hn',
    'rooter': 'iconfont-thunderbolt',
    'btc': 'iconfont-identity-bitcoin',
    'genericWebSite': 'iconfont-identity-website',
    'http': 'iconfont-identity-website',
    'https': 'iconfont-identity-website',
    'dns': 'iconfont-identity-website',
  }

  return types[type]
}

export function proofStatusIcon (proof: Proof): ?IconType {
  switch (proof.state) {
    case proofChecking:
      return 'iconfont-proof-pending'

    case proofNormal:
      return proof.isTracked ? 'iconfont-proof-followed' : 'iconfont-proof-new'

    case proofWarning:
    case proofError:
    case proofRevoked:
      return 'iconfont-proof-broken'

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
