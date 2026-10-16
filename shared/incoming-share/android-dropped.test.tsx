/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, render, screen} from '@testing-library/react'
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
