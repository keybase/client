/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {useUploadCountdown, type UploadCountdownHOCProps} from './use-upload-countdown'

const baseProps: UploadCountdownHOCProps = {
  endEstimate: undefined,
  files: 0,
  isOnline: true,
  totalSyncingBytes: 0,
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(0)
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

const tick = (times = 1) => {
  for (let i = 0; i < times; i++) {
    act(() => {
      jest.advanceTimersByTime(1000)
    })
  }
}

const render = (props: UploadCountdownHOCProps = baseProps) =>
  renderHook((p: UploadCountdownHOCProps) => useUploadCountdown(p), {initialProps: props})

test('stays hidden when there is nothing to upload', () => {
  const {result} = render()
  expect(result.current.showing).toBe(false)
  tick(3)
  expect(result.current.showing).toBe(false)
})

test('shows as soon as there are files, or bytes, to upload', () => {
  const {result: byFiles} = render({...baseProps, files: 2})
  expect(byFiles.current.showing).toBe(true)
  expect(byFiles.current.files).toBe(2)

  const {result: byBytes} = render({...baseProps, totalSyncingBytes: 1024})
  expect(byBytes.current.showing).toBe(true)
})

test('an offline client is never uploading', () => {
  const {result, rerender} = render({...baseProps, files: 2, isOnline: false})
  expect(result.current.showing).toBe(false)
  rerender({...baseProps, files: 2, isOnline: true})
  expect(result.current.showing).toBe(true)
})

test('sticks around for two ticks after the upload finishes, then hides', () => {
  const {result, rerender} = render({...baseProps, files: 2})
  expect(result.current.showing).toBe(true)

  // upload done
  rerender({...baseProps, files: 0})
  expect(result.current.showing).toBe(true)

  tick()
  expect(result.current.showing).toBe(true)
  tick()
  expect(result.current.showing).toBe(false)
})

test('a new upload during the sticky window restarts the countdown and refreshes the glue', () => {
  const {result, rerender} = render({...baseProps, files: 2})
  rerender({...baseProps, files: 0})
  tick()
  expect(result.current.showing).toBe(true)

  // new upload arrives while sticky
  rerender({...baseProps, files: 1})
  expect(result.current.showing).toBe(true)
  tick(5)
  expect(result.current.showing).toBe(true)

  // and finishing again gets the full two ticks of glue, not the leftover one
  rerender({...baseProps, files: 0})
  tick()
  expect(result.current.showing).toBe(true)
  tick()
  expect(result.current.showing).toBe(false)
})

test('an upload that never showed up does not leave the banner sticky', () => {
  const {result, rerender} = render()
  // props churn without ever uploading
  rerender({...baseProps, totalSyncingBytes: 0})
  tick(5)
  expect(result.current.showing).toBe(false)
})

test('timeLeft is formatted from the end estimate and counts down with the clock', () => {
  const {result} = render({...baseProps, endEstimate: 125_000, files: 1})
  expect(result.current.showing).toBe(true)
  expect(result.current.timeLeft).toBe('2 min')

  tick(70)
  expect(result.current.timeLeft).toBe('55 s')
})

test('no end estimate means no time left string', () => {
  const {result} = render({...baseProps, files: 1})
  expect(result.current.timeLeft).toBe('')
})

test('passthrough props are handed back untouched', () => {
  const debugToggleShow = jest.fn()
  const {result} = render({
    ...baseProps,
    debugToggleShow,
    fileName: 'a.txt',
    files: 1,
    smallMode: true,
    totalSyncingBytes: 42,
  })
  expect(result.current).toMatchObject({
    debugToggleShow,
    fileName: 'a.txt',
    files: 1,
    smallMode: true,
    totalSyncingBytes: 42,
  })
})
