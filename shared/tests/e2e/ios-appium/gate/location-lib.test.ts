import {APPLE_PARK, FAR, GO_MOVE_POSTED, GO_RESTORED, GO_TRACKER_STOPPED, holdsLocationMessage, requireFixedPoint, stopLocationBody, watcherRunning} from './location-lib'

test('only the fixed points are taken', () => {
  expect(requireFixedPoint(FAR)).toBe(FAR)
  expect(() => requireFixedPoint({lat: APPLE_PARK.lat + 0.001, lon: APPLE_PARK.lon})).toThrow('fixed points')
  expect(() => requireFixedPoint({lat: 40.7, lon: -74})).toThrow('fixed points')
})

test('the location message is the smoke account’s own text, exactly', () => {
  const msg = (username: string, type: string, body?: string) => ({content: {type, ...(body === undefined ? {} : {text: {body}})}, sender: {username}})
  expect(holdsLocationMessage([msg('testuser', 'text', '/location')], 'testuser', '/location')).toBe(true)
  expect(holdsLocationMessage([msg('testuser', 'text', '/location live 15m')], 'testuser', '/location')).toBe(false)
  expect(holdsLocationMessage([msg('testuser-mac', 'text', '/location')], 'testuser', '/location')).toBe(false)
  expect(holdsLocationMessage([msg('testuser', 'unfurl')], 'testuser', '/location')).toBe(false)
  expect(holdsLocationMessage([], 'testuser', '/location')).toBe(false)
})

test("the service's lines: a posted move in order, and a restore of at least one tracker", () => {
  const lines = ['+ LiveLocationTracker: LocationUpdate', 'tracker[3]: got coords', '+ LiveLocationTracker: updateMapUnfurl']
  expect(GO_MOVE_POSTED.every((re, i) => re.test(lines[i]!))).toBe(true)
  expect(GO_RESTORED.test('LiveLocationTracker: restoreLocked: restored 1 trackers')).toBe(true)
  expect(GO_RESTORED.test('LiveLocationTracker: restoreLocked: restored 0 trackers')).toBe(false)
  expect(GO_TRACKER_STOPPED.test('tracker[4]: stopped, updating with done status')).toBe(true)
})

test('the stop body takes only a conversation id, and reads the tlf name in the app', () => {
  const body = stopLocationBody('0000abcdef0123456789')
  expect(body).toContain("sendTextToConversation(id, meta.tlfname, '/location stop')")
  expect(() => stopLocationBody('team#channel')).toThrow('not one')
})

test('the watcher runs when its last start has no stop after it', () => {
  const line = (m: string) => `2026-11-01 19:40:23.545 Df Keybase[1:2] (Keybase.debug.dylib) KbLocationWatcher: ${m}`
  expect(watcherRunning([line('starting location updates')])).toBe(true)
  expect(watcherRunning([line('starting location updates'), line('location update failed: x')])).toBe(true)
  expect(watcherRunning([line('starting location updates'), line('stopping location updates')])).toBe(false)
  expect(watcherRunning([line('stopping location updates'), line('starting location updates')])).toBe(true)
  expect(watcherRunning([line('not watching location: not authorized (status 0)')])).toBe(false)
  expect(watcherRunning([])).toBe(false)
})
