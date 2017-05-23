// @flow
import {globalColors, globalStyles} from '../styles'
import {
  normal as proofNormal,
  checking as proofChecking,
  revoked as proofRevoked,
  error as proofError,
  warning as proofWarning,
  metaNew,
  metaUpgraded,
  metaUnreachable,
  metaPending,
  metaDeleted,
  metaIgnored,
} from '../constants/tracker'
import type {IconType} from '../common-adapters/icon'
import type {PlatformsExpandedType} from '../constants/types/more.js'
import type {Proof} from '../constants/tracker'

function metaColor(proof: Proof): string {
  switch (proof.meta) {
    case metaNew:
      return globalColors.blue
    case metaUpgraded:
      return globalColors.blue
    case metaUnreachable:
      return globalColors.red
    case metaPending:
      return globalColors.black_40
    case metaDeleted:
      return globalColors.red
    case metaIgnored:
      return globalColors.green
    default:
      return globalColors.blue
  }
}

function proofColor(proof: Proof, forIcon: boolean): string {
  let color = globalColors.blue
  switch (proof.state) {
    case proofNormal: {
      color = proof.isTracked ? (forIcon ? globalColors.green : globalColors.green2) : globalColors.blue
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
  if (proof.state === proofChecking) {
    color = globalColors.black_40
  }
  return color
}

function iconNameForProof({type}: {type: PlatformsExpandedType}): IconType {
  const types = {
    none: 'iconfont-close',
    keybase: 'iconfont-close',
    twitter: 'iconfont-identity-twitter',
    facebook: 'iconfont-identity-facebook',
    github: 'iconfont-identity-github',
    reddit: 'iconfont-identity-reddit',
    pgp: 'iconfont-identity-pgp',
    hackernews: 'iconfont-identity-hn',
    rooter: 'iconfont-thunderbolt',
    btc: 'iconfont-identity-bitcoin',
    zcash: 'iconfont-identity-zcash',
    dnsOrGenericWebSite: 'iconfont-identity-website',
    http: 'iconfont-identity-website',
    https: 'iconfont-identity-website',
    dns: 'iconfont-identity-website',
  }

  return types[type]
}

// TODO (AW): either make this guaranteed to statisfy all potential proof states, or return a default IconType instead of null
function proofStatusIcon(proof: Proof): ?IconType {
  switch (proof.state) {
    case proofChecking:
      return 'iconfont-proof-pending'

    case proofNormal:
      return 'iconfont-proof-good'

    case proofWarning:
    case proofError:
    case proofRevoked:
      return 'iconfont-proof-broken'

    default:
      return null
  }
}

function proofNameStyle(proof: Proof) {
  return {
    color: proofColor(proof, false),
    ...(proof.meta === metaDeleted ? globalStyles.textDecoration('line-through') : {}),
    ...(['btc', 'pgp'].includes(proof.type) ? {fontSize: 13} : {}),
  }
}

export {proofNameStyle, metaColor, proofColor, iconNameForProof, proofStatusIcon}
