import {mainThreadInSnapshot, makeWatchSlot, nextHangState, NO_HANG} from './hang-lib'

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
