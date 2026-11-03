/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render, screen} from '@testing-library/react'

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
