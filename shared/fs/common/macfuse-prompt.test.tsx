/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

const mockNavigateAppend = jest.fn()
jest.mock('@/constants', () => ({
  ...(jest.requireActual('@/constants') as object),
  Router2: {navigateAppend: (...args: Array<unknown>) => mockNavigateAppend(...args)},
}))
jest.mock('@/util/fs-platform', () => ({openMacfuseSiteDesktop: jest.fn(async () => Promise.resolve())}))
jest.mock('./error-state', () => ({useFsErrorActionOrThrow: () => jest.fn()}))
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    Button: ({label, onClick}: {label: string; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, label),
    Styles: {
      createStyleHook:
        <S,>(styles: () => S) =>
        () =>
          styles(),
      globalMargins: {small: 8, tiny: 4},
      padding: () => ({}),
    },
    Text: ({children, onClick}: {children?: React.ReactNode; onClick?: () => void}) =>
      onClick
        ? React.createElement('button', {onClick, type: 'button'}, children)
        : React.createElement('span', null, children),
  }
})

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import * as Constants from '@/constants/fs'
import {openMacfuseSiteDesktop} from '@/util/fs-platform'
import MacfusePrompt, {macfusePromptCopy} from './macfuse-prompt'

const status = (overrides: Partial<T.FS.DriverStatusDisabled>): T.FS.DriverStatusDisabled => ({
  ...Constants.emptyDriverStatusDisabled,
  ...overrides,
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
})

test('each macFUSE state gets its own copy, and Ready gets none', () => {
  expect(macfusePromptCopy(status({macfuse: T.FS.MacfuseState.NotInstalled}))).toEqual({
    action: 'openSite',
    actionLabel: 'Install macFUSE',
    body: 'Keybase can show your files in Finder with macFUSE, a free add-on you install yourself. Keybase works fine without it. After installing, come back here.',
    label: 'Set up Finder access',
    title: 'Use Keybase in Finder',
  })
  expect(
    macfusePromptCopy(status({macfuse: T.FS.MacfuseState.Outdated, macfuseVersion: '4.8.0'}))
  ).toEqual({
    action: 'openSite',
    actionLabel: 'Update macFUSE',
    body: 'Keybase needs macFUSE 5 or newer to show your files in Finder. You have macFUSE 4.8.0.',
    label: 'Update macFUSE',
    title: 'Update macFUSE',
  })
  expect(
    macfusePromptCopy(status({macfuse: T.FS.MacfuseState.Error, macfuseError: 'Error loading kext info: no kext'}))
  ).toEqual({
    action: 'openSite',
    actionLabel: 'Reinstall macFUSE',
    body: "macFUSE is installed but Keybase can't use it: Error loading kext info: no kext",
    label: "Can't use macFUSE",
    title: "Can't use macFUSE",
  })
  expect(macfusePromptCopy(status({kextPermissionError: true}))).toEqual({
    action: 'showKextHelp',
    actionLabel: 'How to allow macFUSE',
    body: "macFUSE is installed, but macOS hasn't allowed its system extension yet.",
    label: 'Allow macFUSE',
    title: 'Allow macFUSE',
  })
  expect(macfusePromptCopy(status({}))).toBeUndefined()
})

test('install and update open the macFUSE site', () => {
  const copy = macfusePromptCopy(status({macfuse: T.FS.MacfuseState.NotInstalled}))!
  render(<MacfusePrompt copy={copy} variant="settings" />)
  expect(screen.getByText('Set up Finder access')).toBeTruthy()
  expect(screen.getByText(copy.body)).toBeTruthy()
  fireEvent.click(screen.getByText('Install macFUSE'))
  expect(openMacfuseSiteDesktop).toHaveBeenCalledTimes(1)
  expect(mockNavigateAppend).not.toHaveBeenCalled()
})

test('the kext help link opens the approval steps and the popup closes after any action', () => {
  const onAction = jest.fn()
  const copy = macfusePromptCopy(status({kextPermissionError: true}))!
  render(<MacfusePrompt copy={copy} onAction={onAction} variant="popup" />)
  fireEvent.click(screen.getByText('How to allow macFUSE'))
  expect(mockNavigateAppend).toHaveBeenCalledWith({name: 'kextPermission', params: {}})
  expect(openMacfuseSiteDesktop).not.toHaveBeenCalled()
  expect(onAction).toHaveBeenCalledTimes(1)
})
