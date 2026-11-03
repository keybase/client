/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, render, screen} from '@testing-library/react'
import type * as React from 'react'
import {resetAllStores} from '@/util/zustand'
import {navigationWrapper} from '@/test/navigation'

import {fakeNativeKb, type FakeNativeKbModule} from '@/test/fake-native-kb'

// The native share slot: a peek reads the held share without clearing it, an ack clears it only when
// its id is the held one's. react-native-kb's own wrapper runs over it.
type Held = {id: number; text?: string; localPaths?: Array<string>; droppedCount: number}
const mockNative = {acks: new Array<number>(), held: undefined as Held | undefined}
jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())
// a heavy child the notices do not depend on
jest.mock('../chat/send-to-chat', () => ({
  SendToChat: () => null,
}))

import IncomingShareMain from './index'

// the screen renders as the incomingShareNew modal of the real navigation tree
const renderShare = (ui: React.ReactElement) =>
  render(ui, {wrapper: navigationWrapper({route: 'incomingShareNew'}).wrapper})

const g = globalThis as unknown as {isAndroid: boolean}

beforeEach(() => {
  g.isAndroid = true
  mockNative.acks = []
  mockNative.held = undefined
  fakeNativeKb.give({
    ackIncomingShare: (id: number) => {
      mockNative.acks.push(id)
      if (mockNative.held?.id === id) mockNative.held = undefined
    },
    peekIncomingShare: (id: number) => {
      const held = mockNative.held
      return held?.id === id ? {droppedCount: held.droppedCount, localPaths: held.localPaths, text: held.text} : null
    },
  })
})

afterEach(() => {
  g.isAndroid = false
  cleanup()
  resetAllStores()
})

const hold = (id: number, droppedCount = 0, localPaths: Array<string> = [`/tmp/${id}.pdf`]) => {
  mockNative.held = {droppedCount, id, localPaths}
}

test('an Android share with dropped files shows the notice on the picker', () => {
  hold(1, 1)
  renderShare(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android text share sent after every file failed shows the notice', () => {
  mockNative.held = {droppedCount: 1, id: 1, text: 'caption'}
  renderShare(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android share whose files all failed says so instead of spinning', () => {
  hold(1, 2, [])
  renderShare(<IncomingShareMain androidShareID={1} />)
  expect(
    screen.getByText('None of the 2 shared items could be prepared. Please try sharing them again.')
  ).toBeTruthy()
})

test('a complete Android share shows no notice', () => {
  hold(1)
  renderShare(<IncomingShareMain androidShareID={1} />)
  expect(screen.queryByText(/couldn't be prepared/)).toBeNull()
})

test('a link whose share is gone says there is nothing to share', () => {
  renderShare(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
})

test('a link with no id neither shows nor takes the held share', () => {
  hold(1, 1)
  const {unmount} = renderShare(<IncomingShareMain />)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
  unmount()
  expect(mockNative.acks).toEqual([])
  expect(mockNative.held?.id).toBe(1)
})

test('the screen itself never finishes its share: unmounting it acks nothing', () => {
  hold(1, 1)
  const {unmount} = renderShare(<IncomingShareMain androidShareID={1} />)
  unmount()
  expect(mockNative.acks).toEqual([])
  renderShare(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('a screen reused for a newer share shows the newer one', () => {
  hold(1)
  const {rerender} = renderShare(<IncomingShareMain androidShareID={1} />)
  hold(2, 1)
  rerender(<IncomingShareMain androidShareID={2} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})
