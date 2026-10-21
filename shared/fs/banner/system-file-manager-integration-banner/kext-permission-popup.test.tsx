/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'

let mockDriverStatus: T.FS.DriverStatus
const mockNavigateUp = jest.fn()
jest.mock('@/constants/platform', () => ({
  ...(jest.requireActual('@/constants/platform') as object),
  isAppleSilicon: false,
}))
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  Router2: {navigateUp: () => mockNavigateUp()},
}))
jest.mock('@/fs/common', () => ({
  useFsErrorActionOrThrow: () => jest.fn(),
  useSystemFileManagerIntegration: () => ({driverStatus: mockDriverStatus}),
}))
jest.mock('@/util/fs-platform', () => ({openSecurityPreferencesDesktop: jest.fn(async () => Promise.resolve())}))
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    ModalScreen: passThrough,
    ProgressIndicator: () => null,
    Styles: {
      createStyleHook:
        <S,>(styles: (theme: unknown) => S) =>
        () =>
          styles({black_63: 'black_63'}),
      globalMargins: {medium: 16},
      globalStyles: {fillAbsolute: {}},
    },
    Text: ({children, onClick}: {children?: React.ReactNode; onClick?: () => void}) =>
      onClick
        ? React.createElement('button', {onClick, type: 'button'}, children)
        : React.createElement('span', null, children),
  }
})

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as Constants from '@/constants/fs'
import {openSecurityPreferencesDesktop} from '@/util/fs-platform'
import KextPermission from './kext-permission-popup'

const setAppleSilicon = (arm: boolean) => {
  jest.requireMock<{isAppleSilicon: boolean}>('@/constants/platform').isAppleSilicon = arm
}
const kextError = {...Constants.emptyDriverStatusDisabled, kextPermissionError: true}
const recoveryStep = /Startup Security Utility/
const allowStep = /click Allow next to the message/

beforeEach(() => {
  mockDriverStatus = kextError
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
})

test('Intel shows only the Allow steps', () => {
  setAppleSilicon(false)
  render(<KextPermission />)
  expect(screen.queryByText(recoveryStep)).toBeNull()
  expect(screen.getByText(allowStep)).toBeTruthy()
  fireEvent.click(screen.getByText('Open Privacy & Security'))
  expect(openSecurityPreferencesDesktop).toHaveBeenCalledTimes(1)
})

test('Apple silicon shows the one-time Recovery steps first, then the Allow steps', () => {
  setAppleSilicon(true)
  render(<KextPermission />)
  expect(screen.getByText(recoveryStep)).toBeTruthy()
  expect(screen.getByText(allowStep)).toBeTruthy()
})

test('it closes once the kext error clears, and not before', () => {
  const {rerender} = render(<KextPermission />)
  expect(mockNavigateUp).not.toHaveBeenCalled()
  mockDriverStatus = {...kextError, isEnabling: true}
  rerender(<KextPermission />)
  expect(mockNavigateUp).not.toHaveBeenCalled()
  mockDriverStatus = Constants.emptyDriverStatusDisabled
  rerender(<KextPermission />)
  expect(mockNavigateUp).toHaveBeenCalledTimes(1)
})

test('opened without a kext error it stays until KBFS mounts', () => {
  mockDriverStatus = Constants.emptyDriverStatusDisabled
  const {rerender} = render(<KextPermission />)
  expect(mockNavigateUp).not.toHaveBeenCalled()
  mockDriverStatus = Constants.emptyDriverStatusEnabled
  rerender(<KextPermission />)
  expect(mockNavigateUp).toHaveBeenCalledTimes(1)
})
