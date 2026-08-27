/// <reference types="jest" />
import {AmpTracker} from './amptracker'
import {maxAmpsLength} from '@/constants/chat/message'

const minBars = 20

const trackerWith = (amps: ReadonlyArray<number>) => {
  const tracker = new AmpTracker()
  amps.forEach(a => {
    tracker.addAmp(a)
  })
  return tracker
}

// amps arrive one per 100ms, so n amps cover n*100ms of audio
const ampsFor = (count: number, value: number) => new Array<number>(count).fill(value)

test('no amps means no bars', () => {
  expect(new AmpTracker().getBucketedAmps(1000)).toEqual([])
})

test('reset drops everything recorded so far', () => {
  const tracker = trackerWith(ampsFor(10, 5))
  expect(tracker.getBucketedAmps(1000).length).toBeGreaterThan(0)
  tracker.reset()
  expect(tracker.getBucketedAmps(1000)).toEqual([])
})

test('a constant amplitude survives rescaling', () => {
  const amps = trackerWith(ampsFor(10, 7)).getBucketedAmps(1000)
  expect(amps).toHaveLength(minBars)
  expect(amps.every(a => a === 7)).toBe(true)
})

test('short clips get the minimum number of bars', () => {
  // 10 amps = 1s of audio; a 1s duration snaps to minBars, so each bar is 50ms
  expect(trackerWith(ampsFor(10, 1)).getBucketedAmps(1000)).toHaveLength(minBars)
  // durations under the low snap point still ask for minBars
  expect(trackerWith(ampsFor(5, 1)).getBucketedAmps(500)).toHaveLength(minBars)
})

test('bar width comes from the duration, so a short duration over-produces bars', () => {
  // the bar width is duration/bars, but bars are emitted until the recorded audio runs
  // out: 1s of audio reported as 500ms yields twice minBars
  expect(trackerWith(ampsFor(10, 1)).getBucketedAmps(500)).toHaveLength(minBars * 2)
})

test('long clips get the maximum number of bars', () => {
  // 30s+ snaps to maxBars, so a 3s clip of audio is spread over 500ms bars
  expect(trackerWith(ampsFor(30, 1)).getBucketedAmps(30000)).toHaveLength(
    Math.ceil(3000 / (30000 / maxAmpsLength))
  )
  expect(trackerWith(ampsFor(30, 1)).getBucketedAmps(60000)).toHaveLength(
    Math.ceil(3000 / (60000 / maxAmpsLength))
  )
})

test('bar count scales along the curve between the snap points', () => {
  // halfway between the snaps the curve is sqrt(0.5), not 0.5
  const duration = 15500
  const expectedBars = Math.floor(minBars + (maxAmpsLength - minBars) * Math.sqrt(0.5))
  const barWidth = duration / expectedBars
  expect(trackerWith(ampsFor(100, 1)).getBucketedAmps(duration)).toHaveLength(
    Math.ceil(10000 / barWidth)
  )
})

test('bars average the amps they cover', () => {
  // 4 amps = 400ms of audio; a 30s duration gives 500ms bars, so all four land in one bar
  const amps = trackerWith([0, 10, 0, 10]).getBucketedAmps(30000)
  expect(amps).toHaveLength(1)
  expect(amps[0]).toBeCloseTo(5)
})

test('bars keep the shape of the signal', () => {
  // silence then noise, bucketed 1:1 (10 amps = 1s of audio, 1s duration, 20 bars)
  const amps = trackerWith([...ampsFor(5, 0), ...ampsFor(5, 10)]).getBucketedAmps(1000)
  expect(amps.slice(0, 10).every(a => a === 0)).toBe(true)
  expect(amps.slice(-8).every(a => a === 10)).toBe(true)
})
