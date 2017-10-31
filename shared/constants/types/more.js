// @flow
import {Component} from 'react' // eslint-disable-line
import pickBy from 'lodash/pickBy'
import * as RPCTypes from './flow-types'

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

export const ProvablePlatforms = Object.keys(pickBy(ProvablePlatformsMap))
export type ProvablePlatformsType = $Keys<typeof ProvablePlatformsMap>

export const PlatformsExpanded = Object.keys(pickBy(PlatformsExpandedMap))
export type PlatformsExpandedType = $Keys<typeof PlatformsExpandedMap>

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export type Exact<X> = $Shape<X> & X

export type Device = {
  name: string,
  deviceID: RPCTypes.DeviceID,
  type: DeviceType,
  created: RPCTypes.Time,
  currentDevice: boolean,
  provisioner: ?RPCTypes.Device,
  provisionedAt: ?RPCTypes.Time,
  revokedAt: ?RPCTypes.Time,
  lastUsed: ?RPCTypes.Time,
}

// Converts a string to the DeviceType enum, logging an error if it doesn't match
export function toDeviceType(s: string): DeviceType {
  switch (s) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return s
    default:
      console.log('Unknown Device Type %s. Defaulting to `desktop`', s)
      return 'desktop'
  }
}

// Try to unwrap the maybe, print error if fails
// $FlowIssue
export function unsafeUnwrap<T>(t: ?T): T {
  if (t == null) {
    console.error('Got null, expected non null')
  }
  return t
}

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
