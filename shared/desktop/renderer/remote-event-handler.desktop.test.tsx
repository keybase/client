/// <reference types="jest" />
import * as RemoteGen from '@/constants/remote-actions'

import {eventFromRemoteWindows, registerRemoteActionHandler} from './remote-event-handler.desktop'

afterEach(() => {
  jest.restoreAllMocks()
})

test('pinentry remote actions route to the registered owner', () => {
  const listener = jest.fn()
  const unregister = registerRemoteActionHandler('pinentry', listener)

  eventFromRemoteWindows(RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))
  eventFromRemoteWindows(RemoteGen.createPinentryOnCancel())

  expect(listener).toHaveBeenNthCalledWith(1, RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))
  expect(listener).toHaveBeenNthCalledWith(2, RemoteGen.createPinentryOnCancel())

  unregister()
})

test('tracker remote actions route to the registered owner', () => {
  const listener = jest.fn()
  const unregister = registerRemoteActionHandler('tracker', listener)

  eventFromRemoteWindows(RemoteGen.createTrackerChangeFollow({follow: true, guiID: 'gui-1'}))
  eventFromRemoteWindows(RemoteGen.createTrackerIgnore({guiID: 'gui-2'}))
  eventFromRemoteWindows(RemoteGen.createTrackerCloseTracker({guiID: 'gui-3'}))
  eventFromRemoteWindows(
    RemoteGen.createTrackerLoad({
      assertion: 'alice',
      forceDisplay: true,
      fromDaemon: false,
      guiID: 'gui-4',
      ignoreCache: true,
      inTracker: true,
      reason: 'testing',
    })
  )

  expect(listener).toHaveBeenNthCalledWith(
    1,
    RemoteGen.createTrackerChangeFollow({follow: true, guiID: 'gui-1'})
  )
  expect(listener).toHaveBeenNthCalledWith(2, RemoteGen.createTrackerIgnore({guiID: 'gui-2'}))
  expect(listener).toHaveBeenNthCalledWith(3, RemoteGen.createTrackerCloseTracker({guiID: 'gui-3'}))
  expect(listener).toHaveBeenNthCalledWith(
    4,
    RemoteGen.createTrackerLoad({
      assertion: 'alice',
      forceDisplay: true,
      fromDaemon: false,
      guiID: 'gui-4',
      ignoreCache: true,
      inTracker: true,
      reason: 'testing',
    })
  )

  unregister()
})

test('stale owner cleanup does not clear newer registration', () => {
  const stale = jest.fn()
  const current = jest.fn()

  const unregisterStale = registerRemoteActionHandler('tracker', stale)
  const unregisterCurrent = registerRemoteActionHandler('tracker', current)

  unregisterStale()
  eventFromRemoteWindows(RemoteGen.createTrackerIgnore({guiID: 'gui-2'}))
  expect(stale).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledWith(RemoteGen.createTrackerIgnore({guiID: 'gui-2'}))

  unregisterCurrent()
})

test('owner handlers stop after unregister', () => {
  const listener = jest.fn()
  const unregister = registerRemoteActionHandler('pinentry', listener)

  unregister()
  eventFromRemoteWindows(RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))

  expect(listener).not.toHaveBeenCalled()
})
