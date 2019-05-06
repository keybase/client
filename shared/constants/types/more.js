// @flow strict

const provablePlatformsMap = {
  dns: true,
  facebook: true,
  github: true,
  hackernews: true,
  http: true,
  https: true,
  reddit: true,
  rooter: __DEV__,
  twitter: true,
  web: true,
}

const platformsExpandedMap = {
  // Flow needs this to be duplicated
  btc: true,
  dns: true,
  dnsOrGenericWebSite: true,
  facebook: true,
  github: true,
  hackernews: true,
  http: true,
  https: true,
  pgp: true,
  reddit: true,
  rooter: __DEV__,
  twitter: true,
  web: true,
  zcash: true,
}

export type ProvablePlatformsType = $Keys<typeof provablePlatformsMap>
export const ProvablePlatforms = Object.keys(provablePlatformsMap).reduce((arr, p) => {
  if (provablePlatformsMap[p]) {
    arr.push(p)
  }
  return arr
}, [])

export type PlatformsExpandedType = $Keys<typeof platformsExpandedMap>
export const PlatformsExpanded: Array<PlatformsExpandedType> = Object.keys(platformsExpandedMap).reduce(
  (arr, p) => {
    if (platformsExpandedMap[p]) {
      arr.push(p)
    }
    return arr
  },
  []
)

export function isPlatformsExpandedType(str: string): ?PlatformsExpandedType {
  if (PlatformsExpanded.includes(str)) {
    // $ForceType flow can't figure this out
    return str
  }
  return null
}
