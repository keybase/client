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
export const normalizeDeviceRE = /[^a-zA-Z0-9]/

export const deviceNameInstructions =
  'Your device name must have 3-64 characters and not end with punctuation.'

export const badDeviceChars = /[^a-zA-Z0-9-_' ]/g
