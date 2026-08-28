/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'

// the real row chrome is native/electron-only; what matters here is which of the
// revoked / active presentations the row picks, which is derived from revokedAt
// alone - revokedByName can be unset on a genuinely revoked device
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    ListItem: ({body, icon}: {body?: React.ReactNode; icon?: React.ReactNode}) =>
      React.createElement('div', null, icon, body),
    Meta: () => React.createElement('div', {'data-meta': 'new'}),
    Styles: {
      createStyleHook:
        <S,>(styles: (theme: unknown) => S) =>
        () =>
          styles({black_20: '#00000033'}),
      globalMargins: {xtiny: 2, xxtiny: 1},
    },
    Text: ({children, style}: {children?: React.ReactNode; style?: {textDecorationLine?: string}}) =>
      React.createElement('span', {'data-decoration': style?.textDecorationLine ?? ''}, children),
  }
})
jest.mock('./device-icon', () => ({
  __esModule: true,
  default: ({style}: {style?: {opacity?: number} | null}) =>
    require('react').createElement('div', {'data-dimmed': String(style?.opacity === 0.3)}),
}))
jest.mock('@/util/use-local-badging', () => ({useIsNew: () => false}))

import {cleanup, render, screen} from '@testing-library/react'
import DeviceRow from './row'

const day = 24 * 60 * 60 * 1000
const makeDevice = (overrides: Partial<T.Devices.Device> = {}): T.Devices.Device => ({
  created: 0,
  currentDevice: false,
  deviceID: 'id-1',
  deviceNumberOfType: 1,
  lastUsed: Date.now() - day,
  name: 'testuser-mac',
  type: 'desktop',
  ...overrides,
})

const decorations = () =>
  [...document.querySelectorAll('[data-decoration]')].map(n => n.getAttribute('data-decoration'))

afterEach(cleanup)

test('an active device shows when it was last used and is not struck through', () => {
  render(<DeviceRow canRevoke={true} device={makeDevice()} firstItem={true} />)

  expect(screen.getByText(/Last used/)).not.toBeNull()
  expect(screen.queryByText(/^Revoked/)).toBeNull()
  expect(decorations()).not.toContain('line-through')
  expect(document.querySelector('[data-dimmed]')?.getAttribute('data-dimmed')).toBe('false')
})

test('revokedAt alone marks the row revoked, even with no revoking device', () => {
  render(
    <DeviceRow
      canRevoke={true}
      device={makeDevice({lastUsed: Date.now() - day, revokedAt: Date.now() - 2 * day})}
      firstItem={true}
    />
  )

  expect(screen.getByText(/^Revoked/)).not.toBeNull()
  expect(screen.queryByText(/Last used/)).toBeNull()
  expect(decorations()).toContain('line-through')
  expect(document.querySelector('[data-dimmed]')?.getAttribute('data-dimmed')).toBe('true')
})

test('an active device with no last used time says so rather than reading as revoked', () => {
  render(<DeviceRow canRevoke={true} device={makeDevice({lastUsed: 0})} firstItem={true} />)

  expect(screen.getByText('Last used unknown')).not.toBeNull()
  expect(decorations()).not.toContain('line-through')
})
