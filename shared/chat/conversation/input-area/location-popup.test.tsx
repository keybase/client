/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import type * as ExpoLocation from 'expo-location'
import logger from '@/logger'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {metasReceived} from '@/chat/inbox/metadata'
import * as Router from '@/constants/router'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {RPCError} from '@/util/errors'
// loaded here, while isMobile is still false, so only location-popup itself sees the mobile flag
import '@/common-adapters'
import '@/stores/config'
import '@/util/platform-specific'
import '@/util/storeless-actions'
import '../data-hooks'
import '../send-actions'
import type LocationPopupType from './location-popup'

type WatchCallback = (location: ExpoLocation.LocationObject) => void

// jest.mock factories may only close over mock-prefixed names
let mockWatchCallback: WatchCallback | undefined
const mockRemove = jest.fn()
const mockWatchPositionAsync = jest.fn(async (_opts: unknown, cb: WatchCallback) => {
  mockWatchCallback = cb
  return Promise.resolve({remove: mockRemove})
})

jest.mock('expo-location', () => ({
  LocationAccuracy: {Highest: 6},
  watchPositionAsync: async (opts: unknown, cb: WatchCallback) => mockWatchPositionAsync(opts, cb),
}))

jest.mock('@/chat/location-map', () => ({
  __esModule: true,
  default: () => null,
}))

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

// The export is picked at module load (`isMobile ? LocationPopupMobile : () => null`), so load it
// with isMobile set and put the flag back before rendering, keeping the desktop common-adapters.
g.isMobile = true
const LocationPopup = (require('./location-popup') as {default: typeof LocationPopupType}).default
g.isMobile = false

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const locationUpdate = 'chat.1.local.locationUpdate'
let fake: FakeEngine
// each fix the service was sent
const updates = () => paramsOf(fake, locationUpdate).map(p => p.coord as unknown)

const makeLocation = (coords: Partial<ExpoLocation.LocationObjectCoords>): ExpoLocation.LocationObject => ({
  coords: {
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    latitude: 0,
    longitude: 0,
    speed: null,
    ...coords,
  },
  timestamp: 0,
})

const renderPopup = async () => {
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey: convID, tlfname: 'testuser,testuser-mac'}],
    undefined,
    {force: true}
  )
  const r = render(<LocationPopup conversationIDKey={convID} />)
  await flush()
  return r
}

const emit = async (coords: Partial<ExpoLocation.LocationObjectCoords>) => {
  act(() => {
    mockWatchCallback?.(makeLocation(coords))
  })
  await flush()
}

beforeEach(() => {
  fake = installFakeEngine()
  fake.answer(locationUpdate, () => null)
  jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  mockWatchCallback = undefined
  mockRemove.mockClear()
  mockWatchPositionAsync.mockClear()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('location popup position watcher', () => {
  test('watches at the highest accuracy and sends each fix as a location update', async () => {
    await renderPopup()

    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1)
    expect(mockWatchPositionAsync.mock.calls[0]?.[0]).toEqual({accuracy: 6})
    expect(updates()).toEqual([])

    await emit({accuracy: 12.9, altitude: 100, latitude: 37.5, longitude: -122.25})
    // accuracy is floored, and only accuracy/lat/lon are sent
    expect(updates()).toEqual([{accuracy: 12, lat: 37.5, lon: -122.25}])

    await emit({accuracy: null, latitude: 1.5, longitude: 2.5})
    // a missing accuracy is sent as 0
    expect(updates()).toEqual([
      {accuracy: 12, lat: 37.5, lon: -122.25},
      {accuracy: 0, lat: 1.5, lon: 2.5},
    ])
  })

  test('a rejected location update is only logged and later fixes still send', async () => {
    fake.answer(locationUpdate, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'location update failed'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const commandStatus = jest.spyOn(Router, 'setThreadInputCommandStatus')
    await renderPopup()

    await emit({accuracy: 5, latitude: 10, longitude: 20})
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(RPCError))
    expect((error.mock.calls[0]?.[1] as RPCError).desc).toBe('location update failed')
    // not treated as a permission failure: no error status is pushed to the composer
    expect(commandStatus).not.toHaveBeenCalled()

    await emit({accuracy: 6, latitude: 11, longitude: 21})
    expect(updates()).toHaveLength(2)
    expect(updates().at(-1)).toEqual({accuracy: 6, lat: 11, lon: 21})
  })

  test('unmounting removes the watch subscription', async () => {
    const {unmount} = await renderPopup()
    expect(mockRemove).not.toHaveBeenCalled()
    unmount()
    expect(mockRemove).toHaveBeenCalledTimes(1)
  })

  test('a failed watch sends no update and reports an error status to the composer', async () => {
    const commandStatus = jest.spyOn(Router, 'setThreadInputCommandStatus')
    mockWatchPositionAsync.mockRejectedValueOnce(new Error('no gps'))
    await renderPopup()

    expect(updates()).toEqual([])
    expect(commandStatus.mock.calls).toEqual([
      [
        convID,
        {
          actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
          displayText: 'Failed to access location. no gps',
          displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
        },
      ],
    ])
  })
})
