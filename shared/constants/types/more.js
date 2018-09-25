// @flow strict

const provablePlatformsMap = {
  twitter: true,
  reddit: true,
  facebook: true,
  github: true,
  hackernews: true,
  dns: true,
  http: true,
  https: true,
  web: true,
  rooter: __DEV__,
}

const platformsExpandedMap = {
  // Flow needs this to be duplicated
  twitter: true,
  reddit: true,
  facebook: true,
  github: true,
  hackernews: true,
  dns: true,
  http: true,
  https: true,
  web: true,
  rooter: __DEV__,
  btc: true,
  zcash: true,
  dnsOrGenericWebSite: true,
  pgp: true,
}

export type ProvablePlatformsType = $Keys<typeof provablePlatformsMap>
export const ProvablePlatforms = Object.keys(provablePlatformsMap).reduce((arr, p) => {
  if (provablePlatformsMap[p]) {
    arr.push(p)
  }
  return arr
}, [])

export type PlatformsExpandedType = $Keys<typeof platformsExpandedMap>
export const PlatformsExpanded = Object.keys(platformsExpandedMap).reduce((arr, p) => {
  if (platformsExpandedMap[p]) {
    arr.push(p)
  }
  return arr
}, [])
