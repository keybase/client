/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'

// the real list/row chrome is native/electron-only; we only care about which
// devices end up in the list, in what order, and whether they can be revoked
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    BoxGrow2: passThrough,
    Button: ({label}: {label?: string}) => React.createElement('div', null, label),
    ClickableBox: passThrough,
    IconAuto: () => React.createElement('div'),
    List: ({
      items,
      renderItem,
    }: {
      items: Array<{key: string}>
      renderItem: (index: number, item: {key: string}) => React.ReactNode
    }) =>
      React.createElement(
        'div',
        null,
        items.map((item, index) => React.createElement('div', {key: item.key}, renderItem(index, item)))
      ),
    LoadingOverlay: () => React.createElement('div'),
    Reloadable: passThrough,
    SectionDivider: ({label, onToggleCollapsed}: {label?: string; onToggleCollapsed?: () => void}) =>
      React.createElement('button', {onClick: onToggleCollapsed, type: 'button'}, label),
    Styles: {
      border: () => ({}),
      borderRadius: 4,
      createStyleHook:
        <S,>(styles: (theme: unknown) => S) =>
        () =>
          styles({black_05: '#0000000d'}),
      globalMargins: {medium: 16, small: 8, tiny: 4, xsmall: 2, xxtiny: 1},
      padding: () => ({}),
      paddingH: () => ({}),
      platformStyles: (s: {common?: object; isElectron?: object}) => s.common ?? s.isElectron ?? {},
      transition: () => ({}),
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
  }
})
jest.mock('./row', () => ({
  __esModule: true,
  default: ({canRevoke, device}: {canRevoke: boolean; device: T.Devices.Device}) =>
    require('react').createElement(
      'div',
      {'data-can-revoke': String(canRevoke)},
      `${device.name}${device.revokedAt ? ' (revoked)' : ''}`
    ),
}))
jest.mock('@/util/use-local-badging', () => {
  const React = require('react')
  return {
    NewItemsContext: React.createContext(new Set<string>()),
    useIsNew: () => false,
    useLocalBadging: () => ({badged: new Set<string>()}),
  }
})
jest.mock('@/engine/action-listener', () => ({useEngineActionListener: () => {}}))
jest.mock('@react-navigation/native', () => ({useNavigation: () => ({setOptions: () => {}})}))

let mockRPCResults: Array<T.RPCGen.DeviceDetail> = []
jest.mock('@/util/use-rpc-load', () => ({
  useRPCLoad: (_call: unknown, _args: unknown, opts: {map: (r: unknown) => unknown}) => ({
    data: opts.map(mockRPCResults),
    reload: () => {},
  }),
}))

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import Devices from './index'

const makeDetail = (
  name: string,
  overrides: {currentDevice?: boolean; revokedAt?: number; type?: string} = {}
): T.RPCGen.DeviceDetail =>
  ({
    currentDevice: overrides.currentDevice ?? false,
    device: {
      cTime: 0,
      deviceID: `id-${name}`,
      deviceNumberOfType: 1,
      encryptKey: '',
      lastUsedTime: 0,
      mTime: 0,
      name,
      status: 0,
      type: overrides.type ?? 'desktop',
      verifyKey: '',
    },
    eldest: false,
    provisionedAt: null,
    provisioner: null,
    revokedAt: overrides.revokedAt ?? null,
    revokedBy: '',
    revokedByDevice: null,
  }) as T.RPCGen.DeviceDetail

const renderedDevices = () =>
  [...document.querySelectorAll('[data-can-revoke]')].map(node => node.textContent)

afterEach(() => {
  cleanup()
  resetAllStores()
  mockRPCResults = []
})

test('active devices list the current device first, then alphabetically', () => {
  mockRPCResults = [
    makeDetail('testuser-zeta'),
    makeDetail('testuser-alpha'),
    makeDetail('testuser-mac', {currentDevice: true}),
  ]

  render(<Devices />)

  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-alpha', 'testuser-zeta'])
})

test('revoked devices stay behind the collapsed section until it is expanded', () => {
  mockRPCResults = [
    makeDetail('testuser-mac', {currentDevice: true}),
    makeDetail('testuser-old', {revokedAt: 1000}),
  ]

  render(<Devices />)

  expect(renderedDevices()).toEqual(['testuser-mac'])

  fireEvent.click(screen.getByText('Revoked devices'))

  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-old (revoked)'])
  expect(screen.queryByText(/Revoked devices are no longer able/)).not.toBeNull()
})

test('revoking is only offered when more than one active device would remain', () => {
  mockRPCResults = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-old', {revokedAt: 1})]

  const {unmount} = render(<Devices />)
  // the revoked device does not count towards the active total
  expect(screen.getByText('testuser-mac').getAttribute('data-can-revoke')).toBe('false')
  unmount()

  mockRPCResults = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-phone')]
  render(<Devices />)
  expect(screen.getByText('testuser-mac').getAttribute('data-can-revoke')).toBe('true')
})

test('the paper key nudge shows only when the user has devices but no paper key', () => {
  mockRPCResults = []
  const {unmount} = render(<Devices />)
  expect(screen.queryAllByText('Create a paper key')).toHaveLength(0)
  unmount()

  mockRPCResults = [makeDetail('testuser-mac', {currentDevice: true})]
  const second = render(<Devices />)
  expect(screen.queryAllByText('Create a paper key').length).toBeGreaterThan(0)
  second.unmount()

  mockRPCResults = [
    makeDetail('testuser-mac', {currentDevice: true}),
    makeDetail('testuser-paper', {type: 'backup'}),
  ]
  render(<Devices />)
  expect(screen.queryAllByText('Create a paper key')).toHaveLength(0)
})
