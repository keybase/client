// @flow
import {Component} from 'react' // eslint-disable-line
import {pickBy} from 'lodash-es'

const ProvablePlatformsMap = {
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

const PlatformsExpandedMap = {
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

export type ProvablePlatformsType = $Keys<typeof ProvablePlatformsMap>
export const ProvablePlatforms: Array<*> = Object.keys(pickBy(ProvablePlatformsMap))

export type PlatformsExpandedType = $Keys<typeof PlatformsExpandedMap>
export const PlatformsExpanded: Array<*> = Object.keys(pickBy(PlatformsExpandedMap))

export type Exact<X> = $Shape<X> & X

// eslint-disable-next-line
type _ReturnValue<A, X, Fn: (...args: A) => X> = X
export type ReturnValue<F> = _ReturnValue<*, *, F>

// eslint-disable-next-line
type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

// eslint-disable-next-line
export type _PropsOf<Props, C: Component<Props, *>> = Props
export type PropsOf<C> = _PropsOf<*, C>

export type DumbComponentMap<C: Component<*, *>> = {
  component: Class<C>,
  mocks: {
    [key: string]: PropsOf<C> | {...$Exact<PropsOf<C>>, parentProps: Object},
  },
}
