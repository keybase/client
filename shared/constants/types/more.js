// @flow
import {Component} from 'react' // eslint-disable-line

const provablePlatformsMap = {
  twitter: true,
  reddit: true,
  facebook: true,
  github: true,
  hackernews: true,
  dns: true,
  http: true,
  https: true,
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

export type Exact<X> = $Shape<X> & X

// eslint-disable-next-line
type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

// eslint-disable-next-line
export type _PropsOf<Props, C: Component<Props, *>> = Props
export type PropsOf<C> = _PropsOf<*, C>
