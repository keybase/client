import type * as T from '@/constants/types'

export type Device = {
  deviceNumberOfType: number
  id: T.Devices.DeviceID
  name: string
  type: T.Devices.DeviceType
}

export type ProvisionRouteError = {
  code: number
  desc: string
  details: string
  fields?: ReadonlyArray<{key?: string; value?: string}>
  message: string
}

export const cleanDeviceName = (name: string) =>
  // map 'smart apostrophes' to ASCII (typewriter apostrophe)
  name.replace(/[‘’`´]/g, "'")

// Copied from go/libkb/checkers.go
export const goodDeviceRE = /^[a-zA-Z0-9][ _'a-zA-Z0-9+‘’—–-]*$/
// eslint-disable-next-line
export const badDeviceRE = /  |[ '_-]$|['_-][ ]?['_-]/
// global: the 3-64 length check strips every separator, not just the first
export const normalizeDeviceRE = /[^a-zA-Z0-9]/g

export const deviceNameInstructions =
  'Your device name must have 3-64 characters and not end with punctuation.'

export const badDeviceChars = /[^a-zA-Z0-9-_' ]/g

// a run of separators (badDeviceRE rejects any two in a row, with or without a
// space between); the capture keeps the first one
// badDeviceRE rejects a double space, and two of ['_-] with at most one space
// between them. It does NOT reject a space next to a single separator, so these
// must not collapse "a - b" or "a 'b" -- the user is still typing those.
export const repeatedSpacesRE = / {2,}/g
// one pass must reach a fixed point: the field shows the cleaned value while
// validation and submit run it again, and the two must agree
export const repeatedDeviceSeparatorsRE = /(['_-])(?: ?['_-])+/g
