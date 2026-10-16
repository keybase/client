/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'

const mockAcks: Array<number> = []
jest.mock('react-native-kb', () => ({
  ackIncomingShare: (id: number) => mockAcks.push(id),
}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({setOptions: () => {}}),
}))
jest.mock('../chat/send-to-chat', () => ({
  SendToChat: () => null,
}))

import IncomingShareMain from './index'

const g = globalThis as unknown as {isAndroid: boolean}

beforeEach(() => {
  g.isAndroid = true
  mockAcks.length = 0
})

afterEach(() => {
  g.isAndroid = false
  cleanup()
  resetAllStores()
})

const setShare = (share: NonNullable<ReturnType<typeof useConfigState.getState>['androidShare']>) =>
  act(() => useConfigState.getState().dispatch.setAndroidShare(share))
const fileShare = (id: number, droppedCount = 0, urls = [`/tmp/${id}.pdf`]) =>
  ({droppedCount, id, type: T.RPCGen.IncomingShareType.file, urls}) as const
const stored = () => useConfigState.getState().androidShare

test('an Android share with dropped files shows the notice on the picker', () => {
  setShare(fileShare(1, 1))
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android text share sent after every file failed shows the notice', () => {
  setShare({droppedCount: 1, id: 1, text: 'caption', type: T.RPCGen.IncomingShareType.text})
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android share whose files all failed says so instead of spinning', () => {
  setShare(fileShare(1, 2, []))
  render(<IncomingShareMain androidShareID={1} />)
  expect(
    screen.getByText('None of the 2 shared items could be prepared. Please try sharing them again.')
  ).toBeTruthy()
})

test('a complete Android share shows no notice', () => {
  setShare(fileShare(1))
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.queryByText(/couldn't be prepared/)).toBeNull()
})

test('an incoming-share link with no Android share behind it says there is nothing to share', () => {
  render(<IncomingShareMain androidShareID={1} />)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
})

test('leaving the share screen clears its share and tells the native side', () => {
  setShare(fileShare(1))
  const {unmount} = render(<IncomingShareMain androidShareID={1} />)
  unmount()
  expect(stored()).toBeUndefined()
  expect(mockAcks).toEqual([1])
})

test('a newer share that arrives while the screen is open, before it closes, is left for its own screen', () => {
  setShare(fileShare(1))
  const {rerender, unmount} = render(<IncomingShareMain androidShareID={1} />)
  setShare(fileShare(2, 1))
  // The old screen waits for the newer share's own link rather than taking it.
  expect(screen.queryByText("1 item couldn't be prepared.")).toBeNull()
  rerender(<IncomingShareMain androidShareID={1} />)
  unmount()
  expect(stored()).toEqual(fileShare(2, 1))

  // Its screen opens several commits later.
  render(<IncomingShareMain androidShareID={2} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('a newer share that arrives after the screen closed is not cleared by it', () => {
  setShare(fileShare(1))
  const {unmount} = render(<IncomingShareMain androidShareID={1} />)
  unmount()
  setShare(fileShare(2, 1))
  render(<IncomingShareMain androidShareID={2} />)
  expect(stored()).toEqual(fileShare(2, 1))
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('a screen replaced in the same commit leaves the newer share to its replacement', () => {
  setShare(fileShare(1))
  const {rerender} = render(<IncomingShareMain key="1" androidShareID={1} />)
  setShare(fileShare(2, 1))
  rerender(<IncomingShareMain key="2" androidShareID={2} />)
  expect(stored()).toEqual(fileShare(2, 1))
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('a screen reused for the newer share owns it from then on', () => {
  setShare(fileShare(1))
  const {rerender, unmount} = render(<IncomingShareMain androidShareID={1} />)
  setShare(fileShare(2, 1))
  rerender(<IncomingShareMain androidShareID={2} />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
  expect(stored()).toEqual(fileShare(2, 1))
  unmount()
  expect(stored()).toBeUndefined()
  expect(mockAcks).toEqual([1, 2])
})
