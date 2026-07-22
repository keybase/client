/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {cleanup, render, screen} from '@testing-library/react'

jest.mock('./button', () => ({
  __esModule: true,
  default: ({label, onClick, disabled}: {label?: string; onClick?: () => void; disabled?: boolean}) =>
    require('react').createElement('button', {disabled, onClick, type: 'button'}, label),
}))
jest.mock('./waiting-button', () => ({
  __esModule: true,
  default: ({label, onClick}: {label?: string; onClick?: () => void}) =>
    require('react').createElement('button', {onClick, type: 'button'}, label),
}))
jest.mock('./button-bar', () => ({
  __esModule: true,
  default: ({children}: {children?: React.ReactNode}) =>
    require('react').createElement('div', null, children),
}))
jest.mock('./box', () => ({
  Box2: ({children}: {children?: React.ReactNode}) => require('react').createElement('div', null, children),
}))
jest.mock('@/styles', () => ({
  globalStyles: {flexOne: {}},
  styleSheetCreate: <T,>(styles: () => T) => styles(),
}))

import ConfirmButtons from './confirm-buttons'

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

describe('ConfirmButtons', () => {
  afterEach(() => {
    cleanup()
    g.isMobile = false
  })

  const props = {
    confirmLabel: 'Yes, delete it',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
  }

  test('desktop renders cancel and confirm', () => {
    g.isMobile = false
    render(<ConfirmButtons {...props} />)
    expect(screen.queryByText('Cancel')).not.toBeNull()
    expect(screen.queryByText('Yes, delete it')).not.toBeNull()
  })

  test('mobile renders confirm only — header Cancel is the single cancel affordance', () => {
    g.isMobile = true
    render(<ConfirmButtons {...props} />)
    expect(screen.queryByText('Cancel')).toBeNull()
    expect(screen.queryByText('Yes, delete it')).not.toBeNull()
  })

  test('mobile split renders confirm only', () => {
    g.isMobile = true
    render(<ConfirmButtons {...props} split={true} />)
    expect(screen.queryByText('Cancel')).toBeNull()
    expect(screen.queryByText('Yes, delete it')).not.toBeNull()
  })

  test('desktop custom cancel label', () => {
    g.isMobile = false
    render(<ConfirmButtons {...props} cancelLabel="Nope" />)
    expect(screen.queryByText('Nope')).not.toBeNull()
  })
})
