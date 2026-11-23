/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import * as RemoteGen from '@/constants/remote-actions'
import {_onEngineIncoming} from '@/constants/init/shared'
import * as T from '@/constants/types'
import {eventFromRemoteWindows} from '@/desktop/renderer/remote-event-handler.desktop'
import logger from '@/logger'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import RemoteTrackers, {runPopupIdentify} from './remote-proxy.desktop'

let errorLog: jest.SpyInstance

beforeEach(() => {
  errorLog = jest.spyOn(logger, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

const failIdentify = async (code: T.RPCGen.StatusCode) => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.identify3.identify3', () => fakeError(code, 'identify failed'))
  const onFailed = jest.fn()
  await runPopupIdentify({assertion: 'testuser', guiID: 'gui-1', ignoreCache: false}, onFailed)
  return onFailed
}

test('an identify the service fails puts the popup in the error state', async () => {
  const onFailed = await failIdentify(T.RPCGen.StatusCode.scgeneric)
  expect(onFailed).toHaveBeenCalledTimes(1)
  expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('Error loading tracker popup'))
})

test.each([
  ['a session cancel', T.RPCGen.StatusCode.sccanceled],
  ['an input cancel', T.RPCGen.StatusCode.scinputcanceled],
])('%s leaves the popup alone and logs no error', async (_, code) => {
  const onFailed = await failIdentify(code)
  expect(onFailed).not.toHaveBeenCalled()
  expect(errorLog).not.toHaveBeenCalled()
})

describe('a tracking change to a shown popup', () => {
  const identify = 'keybase.1.identify3.identify3'
  let fake: FakeEngine

  const openPopup = async (ignoreCache: boolean) => {
    fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
    const held = fake.hold(identify)
    render(<RemoteTrackers />)
    act(() =>
      eventFromRemoteWindows(
        RemoteGen.createTrackerLoad({assertion: 'testuser', guiID: 'gui-1', ignoreCache, inTracker: true, reason: ''})
      )
    )
    await flush()
    return held
  }

  const trackingChanged = async () => {
    await act(async () => {
      await fake.push(
        'keybase.1.NotifyTracking.trackingChanged',
        {isTracking: true, uid: '', username: 'testuser'},
        {oneway: true}
      )
      await flush()
    })
  }

  const identifyCalls = () => fake.calls.filter(c => c.method === identify).map(c => c.params as {ignoreCache: boolean})

  afterEach(() => {
    cleanup()
    resetAllStores()
    uninstallFakeEngine()
  })

  test('keeps a forced check that is still running forced', async () => {
    await openPopup(true)
    await trackingChanged()
    expect(identifyCalls().map(p => p.ignoreCache)).toEqual([true, true])
  })

  test('reruns from the proof cache once the forced check finished', async () => {
    const held = await openPopup(true)
    await act(async () => {
      held[0]!.reply(null)
      await flush()
    })
    await trackingChanged()
    expect(identifyCalls().map(p => p.ignoreCache)).toEqual([true, false])
  })

  test('reruns a cached check from the proof cache', async () => {
    await openPopup(false)
    await trackingChanged()
    expect(identifyCalls().map(p => p.ignoreCache)).toEqual([false, false])
  })
})
