import {makeHangWatch, mainThreadInSnapshot, makeWatchSlot, nextHangState, NO_HANG, protocolSucceeded, STUCK_READS} from './hang-lib'

const report = (mainFrames: Array<string>) =>
  [
    'Call graph:',
    '    1892 Thread_1   DispatchQueue_1: com.apple.main-thread  (serial)',
    ...mainFrames.map(f => `    + 1892 ${f}`),
    '    1892 Thread_2',
    '    + 1892 -[NSObject(UIAccessibilityAutomation) _accessibilityUserTestingSnapshotWithOptions:]',
    '',
    'Total number in stack (recursive counted multiple, when >=5):',
  ].join('\n')

test('the main thread inside the accessibility snapshot is found', () => {
  expect(
    mainThreadInSnapshot(report(['UIApplicationMain', '-[NSObject(UIAccessibilityAutomation) _accessibilityUserTestingSnapshotWithOptions:]']))
  ).toBe(true)
})

test('the snapshot on another thread, or no main thread, is not the main thread stuck', () => {
  expect(mainThreadInSnapshot(report(['UIApplicationMain', 'mach_msg2_trap']))).toBe(false)
  expect(mainThreadInSnapshot('Call graph:\n    10 Thread_9\n    + 10 _accessibilityUserTestingSnapshotWithOptions:')).toBe(false)
})

test('stuck reads count only while no command completes', () => {
  let s = nextHangState(NO_HANG, {commandsDone: 7, inSnapshot: true})
  s = nextHangState(s, {commandsDone: 7, inSnapshot: true})
  s = nextHangState(s, {commandsDone: 7, inSnapshot: true})
  expect(s).toEqual({commandsAtFirst: 7, stuck: 3})
  // a healthy app reading a long list: in the snapshot at every read, but its commands complete
  expect(nextHangState(s, {commandsDone: 9, inSnapshot: true})).toEqual({commandsAtFirst: 9, stuck: 1})
  expect(nextHangState(s, {commandsDone: 7, inSnapshot: false})).toEqual(NO_HANG)
})

test("starting a watch stops the one before it, and stop() stops whichever runs, once", () => {
  const slot = makeWatchSlot()
  const stopped: Array<string> = []
  slot.start(() => {
    stopped.push('a')
    return undefined
  })
  // the next test's watch, after a test mocha timed out without stopping its own
  slot.start(() => {
    stopped.push('b')
    return 'hung'
  })
  expect(stopped).toEqual(['a'])
  expect(slot.stop()).toBe('hung')
  expect(slot.stop()).toBeUndefined()
  expect(stopped).toEqual(['a', 'b'])
})

const stuckSample = report(['UIApplicationMain', '-[NSObject(UIAccessibilityAutomation) _accessibilityUserTestingSnapshotWithOptions:]'])

// A watch whose app is busy and sampled in the snapshot, with the WebDriver requests a test makes
// between reads counted as `succeeded`.
const watchOf = (opts: {sample?: () => Promise<string>} = {}) => {
  const seen = {relaunched: 0, succeeded: 0}
  const watch = makeHangWatch({
    appPid: () => 42,
    cpuPercent: () => 100,
    keep: () => 'hung',
    relaunch: async () => {
      seen.relaunched++
      await Promise.resolve()
    },
    sample:
      opts.sample ??
      (async () => {
        await Promise.resolve()
        return stuckSample
      }),
    succeeded: () => seen.succeeded,
  })
  return {seen, watch}
}

test('a hung app polling isExisting: wrapper commands run, but no request succeeds, so the watch fires', async () => {
  const {seen, watch} = watchOf()
  for (let i = 0; i < STUCK_READS; i++) {
    // isExisting -> findElements: the request times out, the wrapper returns false
    expect(protocolSucceeded({error: new Error('Request timed out')})).toBe(false)
    await watch.read()
  }
  expect(seen.relaunched).toBe(1)
  await expect(watch.hung).resolves.toBe('hung')
  expect(watch.stop()).toBe('hung')
})

test('a healthy app reading a long list is in the snapshot at every read, but its requests succeed, so the watch never fires', async () => {
  const {seen, watch} = watchOf()
  for (let i = 0; i < STUCK_READS * 3; i++) {
    // getPageSource answered
    if (protocolSucceeded({value: '<xml/>'})) seen.succeeded++
    await watch.read()
  }
  expect(seen.relaunched).toBe(0)
  expect(watch.stop()).toBeUndefined()
})

test('a read still sampling when the watch stops does nothing after its await', async () => {
  let release: (report: string) => void = () => {}
  const {seen, watch} = watchOf({
    sample: async () =>
      new Promise<string>(resolve => {
        release = resolve
      }),
  })
  for (let i = 0; i < STUCK_READS - 1; i++) {
    const pending = watch.read()
    release(stuckSample)
    await pending
  }
  const last = watch.read()
  expect(watch.stop()).toBeUndefined()
  release(stuckSample)
  await last
  expect(seen.relaunched).toBe(0)
})
