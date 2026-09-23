/// <reference types="jest" />
import {earthRadiusMeters, shouldRecordFix, type Fix, type FixThrottle} from './location-throttle'

// north returns c moved due north by meters, which is exact under the spherical distance the
// throttle measures.
const north = (c: Fix, meters: number): Fix => ({...c, lat: c.lat + ((meters / earthRadiusMeters) * 180) / Math.PI})
const withAccuracy = (c: Fix, accuracy: number): Fix => ({...c, accuracy})

type Case = {
  name: string
  state: 'active' | 'inactive' | 'background' | 'unknown'
  last: FixThrottle
  next: Fix
  record: boolean
}

const origin: Fix = {accuracy: 10, lat: 37.7749, lon: -122.4194}

const cases: Array<Case> = [
  {
    last: {},
    name: 'first fix since the watch started, in the background',
    next: origin,
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'any move in the foreground',
    next: north(origin, 1),
    record: true,
    state: 'active',
  },
  {
    last: {lastRecorded: origin},
    name: 'short move in the background',
    next: north(origin, 10),
    record: false,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'short move before the app state is known',
    next: north(origin, 10),
    record: false,
    state: 'unknown',
  },
  {
    last: {lastRecorded: origin},
    name: 'short move while on screen but not active',
    next: north(origin, 10),
    record: false,
    state: 'inactive',
  },
  {
    last: {lastRecorded: origin},
    name: 'long move in the background',
    next: north(origin, 100),
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'just past the distance',
    next: north(origin, 65.1),
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'long move with a coarse fix',
    next: withAccuracy(north(origin, 100), 100),
    record: false,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'move past both accuracies',
    next: withAccuracy(north(origin, 111), 100),
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: withAccuracy(origin, 3000)},
    name: 'coarse fixes, just short of the cap',
    next: withAccuracy(north(origin, 199.9), 3000),
    record: false,
    state: 'background',
  },
  {
    last: {lastRecorded: withAccuracy(origin, 3000)},
    name: 'coarse fixes, just past the cap',
    next: withAccuracy(north(origin, 200.1), 3000),
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: withAccuracy(origin, 90)},
    name: 'accuracies summing to just under the cap',
    next: withAccuracy(north(origin, 189), 100),
    record: false,
    state: 'background',
  },
  {
    last: {lastRecorded: withAccuracy(origin, 90)},
    name: 'accuracies summing to just under the cap, moved past them',
    next: withAccuracy(north(origin, 190.1), 100),
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'short move with unknown accuracy',
    next: withAccuracy(north(origin, 10), 0),
    record: false,
    state: 'background',
  },
  {
    last: {lastRecorded: withAccuracy(origin, 100)},
    name: 'short move with a fix more than twice as sharp',
    next: north(origin, 20),
    record: true,
    state: 'background',
  },
  {
    last: {lastRecorded: origin},
    name: 'just short of the distance',
    next: north(origin, 64.9),
    record: false,
    state: 'background',
  },
]

test.each(cases)('$name', ({state, last, next, record}) => {
  const res = shouldRecordFix(state, last, next)
  expect(res.record).toBe(record)
  expect(res.throttle).toEqual(record ? {lastRecorded: next} : last)
})

// Feeds fixes to a fresh throttle in the background and returns the indexes of the ones it records.
const recordedAt = (fixes: Array<Fix>) => {
  const recorded: Array<number> = []
  let throttle: FixThrottle = {}
  fixes.forEach((fix, i) => {
    const res = shouldRecordFix('background', throttle, fix)
    throttle = res.throttle
    if (res.record) recorded.push(i)
  })
  return recorded
}

test('ignores jitter', () => {
  const o = withAccuracy(origin, 100)
  const fixes = [o]
  for (let i = 0; i < 20; i++) {
    fixes.push(north(o, 40), north(o, -40))
  }
  expect(recordedAt(fixes)).toEqual([0])
})

test('slow drift', () => {
  const fixes: Array<Fix> = []
  for (let i = 0; i <= 14; i++) {
    fixes.push(north(origin, 10 * i))
  }
  // 70m from origin at fix 7, then 70m from that at fix 14.
  expect(recordedAt(fixes)).toEqual([0, 7, 14])
})

test('ignores jitter around an outlier anchor', () => {
  const center = withAccuracy(origin, 0)
  const fixes = [withAccuracy(north(center, 40), 100)]
  for (let i = 0; i < 20; i++) {
    fixes.push(withAccuracy(north(center, -40), 65), withAccuracy(north(center, 40), 100))
  }
  expect(recordedAt(fixes)).toEqual([0])
})

test('replaces a coarse anchor', () => {
  const center = origin
  const coarse = withAccuracy(north(center, 300), 1000)
  const fixes = [coarse, center, north(center, 20), north(center, -20), north(center, 70)]
  // The locked-on fix replaces the coarse one, jitter around it is ignored, and a real move from
  // it is recorded.
  expect(recordedAt(fixes)).toEqual([0, 1, 4])
})

test('coarse fixes still record moves', () => {
  // Approximate Location reports every fix kilometres wide, so the fixes alone can never tell a
  // move from jitter; a steady drive still records.
  const o = withAccuracy(origin, 3000)
  const fixes: Array<Fix> = []
  for (let i = 0; i <= 4; i++) {
    fixes.push(north(o, 250 * i))
  }
  expect(recordedAt(fixes)).toEqual([0, 1, 2, 3, 4])
})
