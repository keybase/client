/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import * as RemoteGen from '@/constants/remote-actions'
import * as T from '@/constants/types'
import {eventFromRemoteWindows} from '@/desktop/renderer/remote-event-handler.desktop'
import {installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {flush, tick} from '@/test/flush'
import PinentryProxy from './remote-proxy.desktop'

jest.mock('../desktop/remote/use-browser-window.desktop', () => ({__esModule: true, default: () => {}}))
jest.mock('../desktop/remote/use-serialize-props.desktop', () => ({__esModule: true, default: () => {}}))

afterEach(() => {
  cleanup()
  resetAllStores()
})

// The transport drops a second answer to a prompt and logs it; a prompt answered twice shows here
const answeredTwice = (error: jest.SpyInstance) =>
  error.mock.calls.filter(([m]) => String(m).includes('Attempted to settle response'))

const canceled = {error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'}}
// Ticks outside act(), so a race the push wins leaves no act() running into the next step
const stillWaiting = async (p: Promise<unknown>) =>
  Promise.race([p, tick().then(tick).then(tick).then(() => 'still waiting')])

const pinentry = {
  pinentry: {
    cancelLabel: '',
    features: {showTyping: {allow: true, defaultValue: false, label: '', readonly: false}},
    prompt: 'Enter your password',
    retryLabel: '',
    submitLabel: '',
    type: T.RPCGen.PassphraseType.passPhrase,
    windowTitle: '',
  },
  terminal: null,
}

test('a passphrase prompt held at logout is answered with input canceled', async () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  const fake = installFakeEngine()
  render(<PinentryProxy />)
  let pushed: Promise<unknown> = Promise.resolve()
  // The answerer runs as the push is delivered and sets the popup state
  act(() => {
    pushed = fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})
  })
  await flush()
  act(() => useConfigState.getState().dispatch.setLoggedIn(false))
  await flush()
  await expect(stillWaiting(pushed)).resolves.toEqual(canceled)
  uninstallFakeEngine()
})


test('a second passphrase prompt cancels the held one once and stays pending itself', async () => {
  const logError = jest.spyOn(logger, 'error')
  useConfigState.getState().dispatch.setLoggedIn(true)
  const fake = installFakeEngine()
  render(<PinentryProxy />)
  let first: Promise<unknown> = Promise.resolve()
  let second: Promise<unknown> = Promise.resolve()
  act(() => {
    first = fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})
  })
  await flush()
  act(() => {
    second = fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})
  })
  await flush()
  await expect(stillWaiting(first)).resolves.toEqual(canceled)
  await expect(stillWaiting(second)).resolves.toBe('still waiting')
  // The user cancels the shown (second) prompt; the first must not be answered again
  act(() => eventFromRemoteWindows(RemoteGen.createPinentryOnCancel()))
  await expect(stillWaiting(second)).resolves.toEqual(canceled)
  expect(answeredTwice(logError)).toEqual([])
  uninstallFakeEngine()
})

test('a passphrase prompt while logged out is canceled at once and not held', async () => {
  const logError = jest.spyOn(logger, 'error')
  useConfigState.getState().dispatch.setLoggedIn(false)
  const fake = installFakeEngine()
  render(<PinentryProxy />)
  let pushed: Promise<unknown> = Promise.resolve()
  act(() => {
    pushed = fake.push('keybase.1.secretUi.getPassphrase', pinentry, {sessionID: 0})
  })
  await expect(stillWaiting(pushed)).resolves.toEqual(canceled)
  // Nothing held: a later cancel must not answer it again
  act(() => eventFromRemoteWindows(RemoteGen.createPinentryOnCancel()))
  await flush()
  expect(answeredTwice(logError)).toEqual([])
  uninstallFakeEngine()
})
