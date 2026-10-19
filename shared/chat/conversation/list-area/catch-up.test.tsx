/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {OrangeLineContext} from '../orange-line-context'
import {CatchUp, orangeLineInView, shouldShowCatchUp, useCatchUp} from './catch-up'

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

const lineInView = {loaded: true, newestVisibleOrdinal: ord(60), oldestVisibleOrdinal: ord(40), orangeLineOrdinal: ord(50)}

test('the orange line is in view between the oldest and newest visible messages', () => {
  expect(orangeLineInView(lineInView)).toBe(true)
})

// the oldest visible row may show only its bottom, without the line at its top edge, and the newest
// may sit under the composer
test('the orange line on the oldest or newest visible message is not counted as seen', () => {
  expect(orangeLineInView({...lineInView, orangeLineOrdinal: ord(40)})).toBe(false)
  expect(orangeLineInView({...lineInView, orangeLineOrdinal: ord(60)})).toBe(false)
})

test('the orange line is not in view above or below the viewport', () => {
  expect(orangeLineInView({...lineInView, orangeLineOrdinal: ord(30)})).toBe(false)
  expect(orangeLineInView({...lineInView, orangeLineOrdinal: ord(70)})).toBe(false)
})

test('the orange line is not in view without a line, a viewport or a loaded thread', () => {
  expect(orangeLineInView({...lineInView, orangeLineOrdinal: ord(0)})).toBe(false)
  expect(orangeLineInView({...lineInView, newestVisibleOrdinal: undefined, oldestVisibleOrdinal: undefined})).toBe(false)
  expect(orangeLineInView({...lineInView, loaded: false})).toBe(false)
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
  <OrangeLineContext value={p.orangeLineOrdinal}>
    <Probe loaded={p.loaded ?? true} />
  </OrangeLineContext>
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
      seen?.onViewableOrdinalsChanged(ord(50), ord(90))
    })
    expect(seen?.showCatchUp).toBe(true)
  })

  test('once the orange line has been in view, moving past it keeps the pill hidden', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(5), ord(20))
    })
    expect(seen?.showCatchUp).toBe(false)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50), ord(90))
    })
    expect(seen?.showCatchUp).toBe(false)
  })

  test('a viewport of messages older than the orange line does not count as having seen it', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(1), ord(5))
    })
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50), ord(90))
    })
    expect(seen?.showCatchUp).toBe(true)
  })

  test('a newer orange line shows the pill again after the old one was seen', () => {
    const {rerender} = render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(5), ord(20))
    })
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50), ord(90))
    })
    rerender(<Tree orangeLineOrdinal={ord(30)} />)
    expect(seen?.showCatchUp).toBe(true)
  })

  test('tapping centers on the orange line with no highlight', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50), ord(90))
    })
    act(() => {
      seen?.onCatchUp()
    })
    expect(mockCenterOnMessage).toHaveBeenCalledWith(T.Chat.numberToMessageID(10), 'none')
  })

  test('tapping dismisses the pill even though the viewport has not moved', () => {
    render(<Tree orangeLineOrdinal={ord(10)} />)
    act(() => {
      seen?.onViewableOrdinalsChanged(ord(50), ord(90))
    })
    act(() => {
      seen?.onCatchUp()
    })
    expect(seen?.showCatchUp).toBe(false)
  })
})

// The pill is a ClickableBox, which is a bare div by default: without button semantics it is not a
// tab stop and enter/space do nothing, so keyboard users have no way to reach the unread line.
describe('CatchUp', () => {
  afterEach(cleanup)

  test('is reachable from the keyboard', () => {
    render(<CatchUp onClick={jest.fn()} />)
    expect(screen.getByRole('button')).toHaveProperty('tabIndex', 0)
  })

  test('activates on enter and on space', () => {
    const onClick = jest.fn()
    render(<CatchUp onClick={onClick} />)
    const pill = screen.getByRole('button')
    fireEvent.keyDown(pill, {key: 'Enter'})
    fireEvent.keyDown(pill, {key: ' '})
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
