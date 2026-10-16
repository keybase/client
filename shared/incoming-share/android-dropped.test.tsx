/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'

type Held = {id: number; text?: string; localPaths?: Array<string>; droppedCount: number}
const mockNative = {acks: new Array<number>(), held: undefined as Held | undefined}
jest.mock('react-native-kb', () => ({
  ackIncomingShare: (id: number) => {
    mockNative.acks.push(id)
    if (mockNative.held?.id === id) mockNative.held = undefined
  },
  peekIncomingShare: (id: number) => {
    const held = mockNative.held
    return held?.id === id ? {droppedCount: held.droppedCount, localPaths: held.localPaths, text: held.text} : null
  },
}))
// The route's beforeRemove listeners, which fire only when the route leaves the navigator.
const mockBeforeRemove = new Set<() => void>()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: (event: string, listener: () => void) => {
      if (event !== 'beforeRemove') return () => {}
      mockBeforeRemove.add(listener)
      return () => mockBeforeRemove.delete(listener)
    },
    setOptions: () => {},
  }),
}))
jest.mock('../chat/send-to-chat', () => ({
  SendToChat: () => null,
}))

import IncomingShareMain from './index'

const g = globalThis as unknown as {isAndroid: boolean}

beforeEach(() => {
  g.isAndroid = true
  mockNative.acks = []
  mockNative.held = undefined
  mockBeforeRemove.clear()
})

afterEach(() => {
  g.isAndroid = false
  cleanup()
  resetAllStores()
})

const hold = (id: number, droppedCount = 0, localPaths: Array<string> = [`/tmp/${id}.pdf`]) => {
  mockNative.held = {droppedCount, id, localPaths}
}
const removeRoute = () => act(() => [...mockBeforeRemove].forEach(l => l()))

test('an Android share with dropped files shows the notice on the picker', () => {
  hold(1, 1)
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android text share sent after every file failed shows the notice', () => {
  mockNative.held = {droppedCount: 1, id: 1, text: 'caption'}
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android share whose files all failed says so instead of spinning', () => {
  hold(1, 2, [])
  render(<IncomingShareMain androidShareID={1} />)
  expect(
    screen.getByText('None of the 2 shared items could be prepared. Please try sharing them again.')
  ).toBeTruthy()
})

test('a complete Android share shows no notice', () => {
  hold(1)
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.queryByText(/couldn't be prepared/)).toBeNull()
})

test('a link whose share is gone says there is nothing to share', () => {
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
})

test('a link with no id neither shows nor takes the held share', () => {
  hold(1, 1)
  const {unmount} = render(<IncomingShareMain />)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
  removeRoute()
  unmount()
  expect(mockNative.acks).toEqual([])
  expect(mockNative.held?.id).toBe(1)
})

test('the share is done with only when its route is removed, not when the screen is paused or unmounted', () => {
  hold(1, 1)
  const {unmount} = render(<IncomingShareMain androidShareID={1} />)
  // Paused under a pushed screen, or torn down with its navigator: effects clean up, the route stays.
  unmount()
  expect(mockNative.acks).toEqual([])
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()

  removeRoute()
  expect(mockNative.acks).toEqual([1])
  expect(mockNative.held).toBeUndefined()
})

test('a screen reused for a newer share is done with the newer one when removed', () => {
  hold(1)
  const {rerender} = render(<IncomingShareMain androidShareID={1} />)
  hold(2, 1)
  rerender(<IncomingShareMain androidShareID={2} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
  removeRoute()
  expect(mockNative.acks).toEqual([2])
})
