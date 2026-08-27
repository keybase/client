/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, cleanup, render, screen} from '@testing-library/react'

jest.mock('./box', () => ({
  Box2: ({children}: {children?: React.ReactNode}) => require('react').createElement('div', null, children),
}))
jest.mock('./icon', () => ({
  __esModule: true,
  default: ({type}: {type: string}) =>
    require('react').createElement('span', {'data-testid': 'icon'}, type),
}))
jest.mock('./progress-indicator', () => ({
  __esModule: true,
  default: () => require('react').createElement('span', {'data-testid': 'spinner'}),
}))
jest.mock('./text', () => ({
  __esModule: true,
  default: ({children}: {children?: React.ReactNode}) =>
    require('react').createElement('span', null, children),
}))

import SaveIndicator from './save-indicator'

const spinner = () => screen.queryByTestId('spinner')
const check = () => screen.queryByTestId('icon')

describe('SaveIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  test('shows nothing before anything has been saved', () => {
    render(<SaveIndicator saving={false} />)
    expect(spinner()).toBeNull()
    expect(check()).toBeNull()
  })

  test('mounting mid-save shows the spinner right away, and the check when it finishes', () => {
    const {rerender} = render(<SaveIndicator saving={true} />)
    expect(spinner()).not.toBeNull()
    expect(check()).toBeNull()

    rerender(<SaveIndicator saving={false} />)
    expect(spinner()).toBeNull()
    expect(check()).not.toBeNull()
  })

  test('flipping to saving shows the spinner', () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    expect(spinner()).not.toBeNull()
    expect(check()).toBeNull()
  })

  test('finishing a save shows the check, then clears after a second', () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    rerender(<SaveIndicator saving={false} />)
    expect(check()).not.toBeNull()
    expect(check()?.textContent).toBe('iconfont-check')
    expect(document.body.textContent).toContain('Saved')

    act(() => {
      jest.advanceTimersByTime(999)
    })
    expect(check()).not.toBeNull()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(check()).toBeNull()
    expect(spinner()).toBeNull()
  })

  test('a new save started while the check is up goes straight back to the spinner', () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    rerender(<SaveIndicator saving={false} />)
    expect(check()).not.toBeNull()

    rerender(<SaveIndicator saving={true} />)
    expect(spinner()).not.toBeNull()
    expect(check()).toBeNull()

    // the old 'saved' timer must not clear the in-progress spinner
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(spinner()).not.toBeNull()
  })

  test('re-rendering with an unchanged saving flag does not restart the clear timer', () => {
    const {rerender} = render(<SaveIndicator saving={false} />)
    rerender(<SaveIndicator saving={true} />)
    rerender(<SaveIndicator saving={false} />)
    act(() => {
      jest.advanceTimersByTime(600)
    })
    rerender(<SaveIndicator saving={false} />)
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(check()).toBeNull()
  })
})
