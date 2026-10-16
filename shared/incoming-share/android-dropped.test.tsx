/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'

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
})

afterEach(() => {
  g.isAndroid = false
  cleanup()
  resetAllStores()
})

test('an Android share with dropped files shows the notice on the picker', () => {
  useConfigState
    .getState()
    .dispatch.setAndroidShare({droppedCount: 1, type: T.RPCGen.IncomingShareType.file, urls: ['/tmp/a.pdf']})
  render(<IncomingShareMain />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android text share sent after every file failed shows the notice', () => {
  useConfigState
    .getState()
    .dispatch.setAndroidShare({droppedCount: 1, text: 'caption', type: T.RPCGen.IncomingShareType.text})
  render(<IncomingShareMain />)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('an Android share whose files all failed says so instead of spinning', () => {
  useConfigState.getState().dispatch.setAndroidShare({droppedCount: 2, type: T.RPCGen.IncomingShareType.file, urls: []})
  render(<IncomingShareMain />)
  expect(
    screen.getByText('None of the 2 shared items could be prepared. Please try sharing them again.')
  ).toBeTruthy()
})

test('a complete Android share shows no notice', () => {
  useConfigState
    .getState()
    .dispatch.setAndroidShare({droppedCount: 0, type: T.RPCGen.IncomingShareType.file, urls: ['/tmp/a.pdf']})
  render(<IncomingShareMain />)
  expect(screen.queryByText(/couldn't be prepared/)).toBeNull()
})

test('an incoming-share link with no Android share behind it says there is nothing to share', () => {
  render(<IncomingShareMain />)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
})

const settle = async () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })

test('a new share that replaces the share screen is not cleared by the screen it replaces', async () => {
  const {setAndroidShare} = useConfigState.getState().dispatch
  setAndroidShare({droppedCount: 0, type: T.RPCGen.IncomingShareType.file, urls: ['/tmp/a.pdf']})
  const {rerender} = render(<IncomingShareMain key="a" />)

  const b = {droppedCount: 1, type: T.RPCGen.IncomingShareType.file, urls: ['/tmp/b.pdf']} as const
  act(() => setAndroidShare(b))
  rerender(<IncomingShareMain key="b" />)
  await settle()

  expect(useConfigState.getState().androidShare).toEqual(b)
  expect(screen.getByText("1 item couldn't be prepared.")).toBeTruthy()
})

test('leaving the share screen clears the share', async () => {
  useConfigState
    .getState()
    .dispatch.setAndroidShare({droppedCount: 0, type: T.RPCGen.IncomingShareType.file, urls: ['/tmp/a.pdf']})
  const {unmount} = render(<IncomingShareMain />)
  unmount()
  await settle()

  expect(useConfigState.getState().androidShare).toBeUndefined()
})
