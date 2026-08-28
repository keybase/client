/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as AlphabetIndexNS from './alphabet-index'
import {act, cleanup, render} from '@testing-library/react'

type ViewProps = {
  children?: React.ReactNode
  onLayout?: () => void
}

const mockMeasure = jest.fn()
const mockOnLayout: {fn?: () => void} = {}

// the real View can't lay out in jsdom, so stand in for it: keep the children
// rendering, hand the top-section ref a measure() we can watch, and expose the
// container's onLayout so the test can fire a layout change
jest.mock('react-native', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native')
  const react = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    View: react.forwardRef((p: ViewProps, ref: React.Ref<unknown>) => {
      if (p.onLayout) {
        mockOnLayout.fn = p.onLayout
      }
      if (ref && typeof ref === 'object') {
        ;(ref as {current: unknown}).current = {measure: mockMeasure}
      }
      return react.createElement(react.Fragment, null, p.children)
    }),
  }
})

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

type AlphabetIndexModule = typeof AlphabetIndexNS

// the component is `isMobile ? impl : () => null`, decided at module scope, so the
// platform global has to be set before the module is pulled in. isolateModules
// would hand the module its own copy of react, which breaks hooks.
g.isMobile = true
const AlphabetIndex = (require('./alphabet-index') as AlphabetIndexModule).default

const labels = ['A', 'B', 'C']
const moreLabels = ['A', 'B', 'C', 'D']

// the measure is debounced 200ms inside useTimeout
const settle = () => {
  act(() => {
    jest.advanceTimersByTime(250)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockMeasure.mockClear()
  mockOnLayout.fn = undefined
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

test('measures the top section on mount', () => {
  render(<AlphabetIndex labels={labels} showNumSection={false} onScroll={jest.fn()} />)
  settle()
  expect(mockMeasure).toHaveBeenCalled()
})

// touch y -> letter is computed from the stored pageY/height, so a stale measure
// scrolls to the wrong letter. useTimeout's starter is stable, so the effect only
// re-runs on measureKey, and the label list changing is not a measureKey change
test('re-measures when the scrubber lays out again without measureKey changing', () => {
  const {rerender} = render(
    <AlphabetIndex labels={labels} showNumSection={false} onScroll={jest.fn()} measureKey={false} />
  )
  settle()
  mockMeasure.mockClear()

  rerender(
    <AlphabetIndex labels={moreLabels} showNumSection={false} onScroll={jest.fn()} measureKey={false} />
  )
  settle()
  expect(mockMeasure).not.toHaveBeenCalled()

  expect(mockOnLayout.fn).toBeDefined()
  act(() => {
    mockOnLayout.fn?.()
  })
  settle()
  expect(mockMeasure).toHaveBeenCalled()
})
