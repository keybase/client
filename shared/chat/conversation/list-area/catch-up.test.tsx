/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {OrangeLineContext} from '../orange-line-context'
import {shouldShowCatchUp, useCatchUp} from './catch-up'

const ord = T.Chat.numberToOrdinal

// The orange line sits at ordinal 10, the viewport starts at 50: the unread boundary is off
// screen above.
const scrolledPastTheOrangeLine = {
  dismissedOrdinal: ord(0),
  loaded: true,
  oldestVisibleOrdinal: ord(50),
  orangeLineOrdinal: ord(10),
  threadSearchVisible: false,
}

test('shows when the orange line is older than the oldest visible message', () => {
  expect(shouldShowCatchUp(scrolledPastTheOrangeLine)).toBe(true)
})

test('hides when there is no orange line at all', () => {
  expect(shouldShowCatchUp({...scrolledPastTheOrangeLine, orangeLineOrdinal: ord(0)})).toBe(false)
})

test('hides when the orange line is the oldest visible message', () => {
  expect(shouldShowCatchUp({...scrolledPastTheOrangeLine, orangeLineOrdinal: ord(50)})).toBe(false)
})

test('hides before the list has reported what it can see', () => {
  expect(shouldShowCatchUp({...scrolledPastTheOrangeLine, oldestVisibleOrdinal: undefined})).toBe(false)
})

test('hides until the thread has loaded', () => {
  expect(shouldShowCatchUp({...scrolledPastTheOrangeLine, loaded: false})).toBe(false)
})

test('hides while thread search is open', () => {
  expect(shouldShowCatchUp({...scrolledPastTheOrangeLine, threadSearchVisible: true})).toBe(false)
})

test('stays hidden once dismissed for this orange line', () => {
  expect(shouldShowCatchUp({...scrolledPastTheOrangeLine, dismissedOrdinal: ord(10)})).toBe(false)
})

test('comes back when a newer orange line replaces the dismissed one', () => {
  expect(
    shouldShowCatchUp({...scrolledPastTheOrangeLine, dismissedOrdinal: ord(10), orangeLineOrdinal: ord(20)})
  ).toBe(true)
})

const mockCenterOnMessage = jest.fn()
let mockRouteParams: {threadSearch?: {query?: string}} | undefined

jest.mock('../center-context', () => ({
  useConversationCenterActions: () => ({centerOnMessage: mockCenterOnMessage}),
}))
jest.mock('../thread-search-route', () => ({useChatThreadRouteParams: () => mockRouteParams}))

let seen: ReturnType<typeof useCatchUp> | undefined

const Probe = (p: {loaded: boolean}) => {
  const catchUp = useCatchUp({loaded: p.loaded})
  // captured in an effect: assigning module state during render is a side effect the lint rejects
  React.useEffect(() => {
    seen = catchUp
  })
  return null
}

const Tree = (p: {loaded?: boolean; orangeLineOrdinal: T.Chat.Ordinal}) => (
  <OrangeLineContext.Provider value={p.orangeLineOrdinal}>
    <Probe loaded={p.loaded ?? true} />
  </OrangeLineContext.Provider>
)

describe('useCatchUp', () => {
  beforeEach(() => {
    mockCenterOnMessage.mockClear()
    mockRouteParams = undefined
    seen = undefined
  })
  afterEach(cleanup)

  test('stays hidden until the list reports a viewport above the orange line', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    expect(seen?.showCatchUp).toBe(false)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50))
    })
    expect(seen?.showCatchUp).toBe(true)
  })

  test('tapping centers on the orange line with no highlight', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50))
    })
    act(() => {
      seen?.onCatchUp()
    })
    expect(mockCenterOnMessage).toHaveBeenCalledWith(T.Chat.numberToMessageID(10), 'none')
  })

  test('tapping dismisses the pill even though the viewport has not moved', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50))
    })
    act(() => {
      seen?.onCatchUp()
    })
    expect(seen?.showCatchUp).toBe(false)
  })
})
