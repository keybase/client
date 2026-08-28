/// <reference types="jest" />
import {getDeviceIconType, getDeviceRevokeIconType} from './device-icon'

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

afterEach(() => {
  g.isMobile = false
})

test('getDeviceIconType picks the per-device background variant when one exists', () => {
  expect(getDeviceIconType('desktop', 3, 32)).toBe('icon-computer-background-3-32')
  expect(getDeviceIconType('mobile', 1, 96)).toBe('icon-phone-background-1-96')
})

test('getDeviceIconType marks the current device with the success variant', () => {
  expect(getDeviceIconType('desktop', 3, 32, true)).toBe('icon-computer-success-background-3-32')
})

test('getDeviceIconType keeps the per-device background when the success art is missing', () => {
  // success art stops at 48px, so the current device keeps its colored tile at 64/96
  expect(getDeviceIconType('mobile', 2, 64, true)).toBe('icon-phone-background-2-64')
  expect(getDeviceIconType('desktop', 3, 96, true)).toBe('icon-computer-background-3-96')
})

test('getDeviceIconType falls back to the plain icon when no background art exists at all', () => {
  expect(getDeviceIconType('mobile', 11 as never, 64, true)).toBe('icon-phone-64')
  expect(getDeviceIconType('mobile', 11 as never, 64)).toBe('icon-phone-64')
})

test('getDeviceIconType ignores the icon number for paper keys', () => {
  expect(getDeviceIconType('backup', 7, 64)).toBe('icon-paper-key-64')
  // paper keys have no success variant, so current-ness must not change the icon
  expect(getDeviceIconType('backup', 7, 64, true)).toBe('icon-paper-key-64')
})

test('getDeviceRevokeIconType uses the 48px revoke art on desktop', () => {
  g.isMobile = false
  expect(getDeviceRevokeIconType('desktop', 2)).toBe('icon-computer-revoke-background-2-48')
  expect(getDeviceRevokeIconType('backup', 2)).toBe('icon-paper-key-revoke-48')
})

test('getDeviceRevokeIconType uses the 64px revoke art on mobile', () => {
  g.isMobile = true
  expect(getDeviceRevokeIconType('mobile', 2)).toBe('icon-phone-revoke-background-2-64')
  expect(getDeviceRevokeIconType('backup', 2)).toBe('icon-paper-key-revoke-64')
})

test('getDeviceRevokeIconType falls back to the plain revoke icon when the background art is missing', () => {
  g.isMobile = false
  // revoke art only goes up to background-10, so an out-of-range number drops to the plain icon
  expect(getDeviceRevokeIconType('mobile', 11 as never)).toBe('icon-phone-revoke-48')
})
