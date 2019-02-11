// @flow
import {globalColors} from '../styles'
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
import type {IconType} from '../common-adapters'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {Proof} from '../constants/types/tracker'

function metaColor(proof: Proof): string {
  switch (proof.meta) {
    case metaNew:
      return globalColors.blue
    case metaUpgraded:
      return globalColors.blue
    case metaUnreachable:
      return globalColors.red
    case metaPending:
      return globalColors.black_50
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
      color = proof.isTracked ? globalColors.green : forIcon ? globalColors.blue2 : globalColors.blue
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
    color = globalColors.black_50
  }
  return color
}

function iconNameForProof({type}: {type: PlatformsExpandedType}): IconType {
  const types = {
    btc: 'iconfont-identity-bitcoin',
    dns: 'iconfont-identity-website',
    dnsOrGenericWebSite: 'iconfont-identity-website',
    facebook: 'iconfont-identity-facebook',
    github: 'iconfont-identity-github',
    hackernews: 'iconfont-identity-hn',
    http: 'iconfont-identity-website',
    https: 'iconfont-identity-website',
    keybase: 'iconfont-close',
    none: 'iconfont-close',
    pgp: 'iconfont-identity-pgp',
    reddit: 'iconfont-identity-reddit',
    rooter: 'iconfont-thunderbolt',
    twitter: 'iconfont-identity-twitter',
    web: 'iconfont-identity-website',
    zcash: 'iconfont-identity-zcash',
  }

  return types[type]
}

// TODO (AW): either make this guaranteed to satisfy all potential proof states, or return a default IconType instead of null
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
    ...(proof.meta === metaDeleted ? {textDecorationLine: 'line-through'} : {}),
    ...(['btc', 'pgp'].includes(proof.type) ? {fontSize: 13} : {}),
  }
}

export {proofNameStyle, metaColor, proofColor, iconNameForProof, proofStatusIcon}
