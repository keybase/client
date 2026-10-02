/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'
import {installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import PinentryProxy from './remote-proxy.desktop'

jest.mock('../desktop/remote/use-browser-window.desktop', () => ({__esModule: true, default: () => {}}))
jest.mock('../desktop/remote/use-serialize-props.desktop', () => ({__esModule: true, default: () => {}}))

afterEach(() => {
  cleanup()
  resetAllStores()
})

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
  await expect(Promise.race([pushed, flush().then(() => 'still waiting')])).resolves.toEqual({
    error: {code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'},
  })
  uninstallFakeEngine()
})
