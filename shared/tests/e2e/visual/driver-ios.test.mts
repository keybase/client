/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ACCESSIBILITY_KEYS, STATUS_BAR_ARGS, STILL_VIDEOS, appiumPort, clipToWindow, iosCleanupCommands, recaptureAfterDrop, recoverApp, type RecoverDeps, recoveryFor, scrollToTarget, targetState, typeIntoTarget, visualCapabilities} from './driver-ios.mts'
import {pidFromLaunchctl} from '../ios-appium/helpers/app.ts'

test('mask rects outside the window are dropped and the rest clipped to it', () => {
  const win = {height: 800, width: 400}
  assert.deepEqual(
    clipToWindow(
      [
        {height: 20, width: 100, x: 10, y: 10},
        {height: 20, width: 100, x: 10, y: 900},
        {height: 20, width: 100, x: -500, y: 10},
        {height: 40, width: 100, x: 350, y: 790},
      ],
      win
    ),
    [
      {height: 20, width: 100, x: 10, y: 10},
      {height: 10, width: 50, x: 350, y: 790},
    ]
  )
})

const withPort = <T,>(port: string | undefined, f: () => T): T => {
  const saved = process.env['KB_APPIUM_PORT']
  if (port === undefined) delete process.env['KB_APPIUM_PORT']
  else process.env['KB_APPIUM_PORT'] = port
  try {
    return f()
  } finally {
    if (saved === undefined) delete process.env['KB_APPIUM_PORT']
    else process.env['KB_APPIUM_PORT'] = saved
  }
}

test('status bar override pins 9:41, full wifi/cell bars and a charged battery', () => {
  assert.deepEqual(
    [...STATUS_BAR_ARGS],
    [
      '--time', '9:41',
      '--dataNetwork', 'wifi',
      '--wifiMode', 'active',
      '--wifiBars', '3',
      '--cellularMode', 'active',
      '--cellularBars', '4',
      '--batteryState', 'charged',
      '--batteryLevel', '100',
    ]
  )
})

test('reduce motion and reduce transparency are the accessibility settings a run turns on', () => {
  assert.deepEqual([...ACCESSIBILITY_KEYS], ['ReduceMotionEnabled', 'EnhancedBackgroundContrastEnabled'])
})

test('default Appium port keeps the default WDA port', () => {
  withPort(undefined, () => {
    assert.equal(appiumPort(), 4723)
    const caps = visualCapabilities('udid-1') as Record<string, unknown>
    assert.equal(caps['appium:udid'], 'udid-1')
    assert.equal(caps['appium:bundleId'], 'keybase.ios')
    assert.equal(caps['appium:noReset'], true)
    assert.equal(caps['appium:wdaLocalPort'], undefined)
  })
})

test('another Appium port gets its own WDA port', () => {
  withPort('4725', () => {
    assert.equal(appiumPort(), 4725)
    const caps = visualCapabilities('udid-1') as Record<string, unknown>
    assert.equal(caps['appium:wdaLocalPort'], 8102)
  })
})

test('cleanup commands undo what prepare changed, then relaunch the app and stop Appium', () => {
  const original = {
    accessibility: [
      {key: 'ReduceMotionEnabled', value: undefined},
      {key: 'EnhancedBackgroundContrastEnabled', value: '0'},
    ],
    appearance: 'dark',
  }
  assert.deepEqual(iosCleanupCommands({appium: true, original, port: 4723, udid: 'U'}), [
    'xcrun simctl status_bar U clear',
    'xcrun simctl ui U appearance dark',
    'xcrun simctl spawn U defaults delete com.apple.Accessibility ReduceMotionEnabled',
    'xcrun simctl spawn U defaults write com.apple.Accessibility EnhancedBackgroundContrastEnabled -bool false',
    'xcrun simctl terminate U keybase.ios; xcrun simctl launch U keybase.ios',
    "kill $(lsof -t -iTCP:4723 -sTCP:LISTEN)   # the gate's Appium",
  ])
  // before prepare touched the simulator, only Appium is left to stop
  assert.deepEqual(iosCleanupCommands({appium: true, original: undefined, port: 4724, udid: 'U'}), [
    "kill $(lsof -t -iTCP:4724 -sTCP:LISTEN)   # the gate's Appium",
  ])
  assert.deepEqual(iosCleanupCommands({appium: false, original: undefined, port: 4723, udid: 'U'}), [])
})

// ---- scrollToTarget, run against a fake fiber tree

type Fiber = {tag: number; memoizedProps?: object; stateNode?: unknown; return?: Fiber; child?: Fiber; sibling?: Fiber}
type Rect = {top: number; left: number; height: number; width: number}
const el = (r: Rect) => ({getBoundingClientRect: () => r})
const host = (testID: string, r: Rect): Fiber => ({memoizedProps: {testID}, stateNode: {canonical: {publicInstance: el(r)}}, tag: 5})
// parent -> child links, each child's return set, as React keeps them
const chain = (...fs: Array<Fiber>) => {
  for (let i = 0; i + 1 < fs.length; i++) {
    fs[i]!.child = fs[i + 1]
    fs[i + 1]!.return = fs[i]
  }
  return fs[0]!
}
// a screen component: react-navigation hands it its route and navigation
const screen = (focused = true): Fiber => ({memoizedProps: {navigation: {isFocused: () => focused}, route: {key: 'r'}}, tag: 0})
// a parent whose children are the given fibers, linked as React keeps siblings
const parent = (p: Fiber, ...children: Array<Fiber>) => {
  p.child = children[0]
  children.forEach((c, i) => {
    c.return = p
    c.sibling = children[i + 1]
  })
  return p
}
// Runs a driver script against a fake app: the fiber tree, the renderer (which hands out a host
// fiber's public instance, kept on the fiber here) and an 800 tall window.
const runScript = <R,>(root: Fiber, script: string): R => {
  const hook = {getFiberRoots: () => [{current: root}], renderers: new Map([[1, {}]])}
  const kbModule = (m: string) =>
    m.endsWith('Dimensions.js')
      ? {get: () => ({height: 800, width: 400})}
      : {getPublicInstanceFromInternalInstanceHandle: (f: Fiber) => (f.stateNode as {canonical: {publicInstance: unknown}}).canonical.publicInstance}
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const body = new Function('globalThis', 'kbModule', script) as (g: object, k: typeof kbModule) => R
  return body({__REACT_DEVTOOLS_GLOBAL_HOOK__: hook}, kbModule)
}
const runIn = (root: Fiber, testID: string) => runScript<string>(root, scrollToTarget(testID))
const scrollView = (content: Rect, port: Rect, horizontal = false) => {
  const calls: Array<object> = []
  const node = {
    getInnerViewRef: () => el(content),
    getNativeScrollRef: () => el(port),
    props: {horizontal},
    scrollTo: (o: object) => calls.push(o),
  }
  return {calls, fiber: {stateNode: node, tag: 1} as Fiber}
}

test('scrollToTarget centres the row of a virtualized list, not the ScrollView inside the list', () => {
  const sv = scrollView({height: 5000, left: 0, top: 0, width: 400}, {height: 800, left: 0, top: 0, width: 400})
  const toIndex: Array<object> = []
  const list = {stateNode: {scrollToIndex: (o: object) => toIndex.push(o)}, tag: 1} as Fiber
  const cell = {memoizedProps: {cellKey: 'k', index: 7}, tag: 0} as Fiber
  const root = chain({tag: 3}, screen(), list, sv.fiber, cell, host('target', {height: 10, left: 0, top: 3000, width: 10}))
  assert.equal(runIn(root, 'target'), 'row')
  assert.deepEqual(toIndex, [{animated: false, index: 7, viewPosition: 0.5}])
  assert.deepEqual(sv.calls, [])
})

test('scrollToTarget centres a view in a ScrollView by its offset in the content, clamped to the content', () => {
  // content scrolled up by 100: the view sits at 1000 in the content, the port is 800 tall
  const port = {height: 800, left: 0, top: 50, width: 400}
  const mid = scrollView({height: 3000, left: 0, top: -50, width: 400}, port)
  assert.equal(runIn(chain({tag: 3}, screen(), mid.fiber, host('target', {height: 100, left: 0, top: 950, width: 400})), 'target'), 'scrollView')
  assert.deepEqual(mid.calls, [{animated: false, x: 0, y: 650}])
  // near the end: no further than the content allows
  const end = scrollView({height: 1000, left: 0, top: 50, width: 400}, port)
  runIn(chain({tag: 3}, screen(), end.fiber, host('target', {height: 50, left: 0, top: 1000, width: 400})), 'target')
  assert.deepEqual(end.calls, [{animated: false, x: 0, y: 200}])
  // near the start: not before it
  const start = scrollView({height: 3000, left: 0, top: 50, width: 400}, port)
  runIn(chain({tag: 3}, screen(), start.fiber, host('target', {height: 50, left: 0, top: 60, width: 400})), 'target')
  assert.deepEqual(start.calls, [{animated: false, x: 0, y: 0}])
  const across = scrollView({height: 100, left: 0, top: 0, width: 2000}, {height: 100, left: 0, top: 0, width: 400}, true)
  runIn(chain({tag: 3}, screen(), across.fiber, host('target', {height: 10, left: 1000, top: 0, width: 100})), 'target')
  assert.deepEqual(across.calls, [{animated: false, x: 850, y: 0}])
})

test('scrollToTarget leaves a view in neither a row nor a ScrollView to the caller, and throws for a missing one', () => {
  assert.equal(runIn(chain({tag: 3}, screen(), {tag: 0}, host('target', {height: 1, left: 0, top: 0, width: 1})), 'target'), 'none')
  assert.throws(() => runIn(chain({tag: 3}), 'target'), /no host view with testID target/)
})

test('scrollToTarget takes the view in the focused screen over one outside every screen, and never a hidden screen\'s', () => {
  const rect = {height: 10, left: 0, top: 1000, width: 10}
  const port = {height: 800, left: 0, top: 0, width: 400}
  const views = () => [0, 1, 2].map(() => scrollView({height: 3000, left: 0, top: 0, width: 400}, port))
  const [shown, hidden, overlay] = views()
  // the walk meets the hidden screen's view first, then the overlay's, then the focused screen's
  const root = parent(
    {tag: 3},
    parent(
      {tag: 0},
      chain(screen(true), shown!.fiber, host('target', rect)),
      chain({tag: 0}, overlay!.fiber, host('target', rect)),
      chain(screen(false), hidden!.fiber, host('target', rect))
    )
  )
  assert.equal(runIn(root, 'target'), 'scrollView')
  assert.deepEqual([shown!.calls.length, hidden!.calls.length, overlay!.calls.length], [1, 0, 0])
  // a sheet or overlay outside the navigator, when no screen has one
  const [, hidden2, overlay2] = views()
  const noFocused = parent({tag: 3}, chain(screen(false), hidden2!.fiber, host('target', rect)), chain({tag: 0}, overlay2!.fiber, host('target', rect)))
  assert.equal(runIn(noFocused, 'target'), 'scrollView')
  assert.deepEqual([hidden2!.calls.length, overlay2!.calls.length], [0, 1])
  const onlyHidden = parent({tag: 3}, chain(screen(false), {tag: 0}, host('target', rect)))
  assert.throws(() => runIn(onlyHidden, 'target'), /no host view with testID target in the focused screen or an overlay/)
})

test('the target lookup stops at the first focused match', () => {
  const rect = {height: 10, left: 0, top: 0, width: 10}
  // the target's next sibling, which a walk that went on past the target would read
  const poisoned = {tag: 5} as Fiber
  Object.defineProperty(poisoned, 'memoizedProps', {
    get: () => {
      throw new Error('walked past the first match')
    },
  })
  const root = parent({tag: 3}, chain(screen(true), parent({tag: 0}, host('target', rect), poisoned)))
  assert.equal(runScript(root, targetState('target')), 'inView')
})

test('targetState waits for a target, then says whether all of it shows in the window, clipped by what scrolls it', () => {
  const at = (top: number, height = 50) => ({height, left: 0, top, width: 100})
  const state = (...fs: Array<Fiber>) => runScript(parent({tag: 3}, chain(screen(true), ...fs)), targetState('target'))
  assert.equal(runScript(parent({tag: 3}, chain(screen(false), host('target', at(10)))), targetState('target')), 'missing')
  assert.equal(state(host('target', at(10))), 'inView')
  assert.equal(state(host('target', at(900))), 'outside')
  // across the bottom of the 800 tall window: it shows only in part
  assert.equal(state(host('target', at(780))), 'outside')
  assert.equal(state(host('target', at(750))), 'inView')
  // below the fold of a scroll view that ends at 400, though inside the window; or across its fold
  const list = () => ({...host('list', {height: 400, left: 0, top: 0, width: 400}), type: 'RCTScrollView'})
  assert.equal(state(list(), host('target', at(500))), 'outside')
  assert.equal(state(list(), host('target', at(380))), 'outside')
  assert.equal(state(list(), host('target', at(340))), 'inView')
  // taller than the scroll view: in view when it fills it, as much of it as fits
  assert.equal(state(list(), host('target', at(-100, 600))), 'inView')
  assert.equal(state(list(), host('target', at(100, 600))), 'outside')
  // empty
  assert.equal(state(host('target', at(10, 0))), 'outside')
})

test('STILL_VIDEOS pauses every player held in hook state on its first frame', () => {
  const player = () => ({currentTime: 5, pause() {
    this.paused = true
  }, paused: false, replace: () => {}})
  const [a, b] = [player(), player()]
  // useVideoPlayer's state, alone and as a [player, setter] pair, in two components' hook lists
  const hooks = (v: unknown) => ({memoizedState: {memoizedState: v, next: null}, tag: 0})
  const root = parent({tag: 3}, hooks(a) as Fiber, chain({tag: 0}, hooks([b, () => {}]) as Fiber))
  assert.equal(runScript(root, STILL_VIDEOS), 2)
  assert.deepEqual([a.paused, a.currentTime, b.paused, b.currentTime], [true, 0, true, 0])
})

// ---- typeIntoTarget, run against a fake fiber tree

// Kb.Input3 (onEnterKeyDown) over RN's TextInput, which hands its props (onSubmitEditing among
// them) to the native host input
const input3 = (typed: Array<string>, submitted: Array<string>) => {
  const onChangeText = (t: string) => typed.push(t)
  const onSubmitEditing = (e: {nativeEvent: {text: string}}) => submitted.push(e.nativeEvent.text)
  return chain(
    {memoizedProps: {onChangeText, onEnterKeyDown: onSubmitEditing}, tag: 0},
    {memoizedProps: {onChangeText, onSubmitEditing}, tag: 11},
    {memoizedProps: {onChangeText, onSubmitEditing}, tag: 0},
    {memoizedProps: {onChange: () => {}, onChangeText, onSubmitEditing}, tag: 5}
  )
}
const typeIn = (root: Fiber, enter: boolean) => {
  const hook = {getFiberRoots: () => [{current: root}], renderers: new Map([[1, {}]])}
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const body = new Function('globalThis', typeIntoTarget('row', 'visual gate', enter)) as (g: object) => void
  body({__REACT_DEVTOOLS_GLOBAL_HOOK__: hook})
}

test('typeIntoTarget types through the native input under the testID, and presses Enter only when asked', () => {
  const typed: Array<string> = []
  const submitted: Array<string> = []
  const row = chain({memoizedProps: {testID: 'row'}, tag: 5}, {tag: 0}, input3(typed, submitted))
  const other: Fiber = {memoizedProps: {onChangeText: () => typed.push('wrong')}, tag: 5}
  row.sibling = other
  const root = chain({tag: 3}, screen(), row)
  typeIn(root, false)
  assert.deepEqual([typed, submitted], [['visual gate'], []])
  typeIn(root, true)
  assert.deepEqual([typed, submitted], [['visual gate', 'visual gate'], ['visual gate']])
})

test('typeIntoTarget types into the focused screen\'s input, never a hidden screen\'s', () => {
  const shown: Array<string> = []
  const hidden: Array<string> = []
  const field = (typed: Array<string>) => chain({memoizedProps: {testID: 'row'}, tag: 5}, input3(typed, []))
  // the walk meets the hidden screen's field first
  const root = parent({tag: 3}, parent({tag: 0}, chain(screen(true), field(shown)), chain(screen(false), field(hidden))))
  typeIn(root, false)
  assert.deepEqual([shown, hidden], [['visual gate'], []])
})

test('a broken app is reloaded, unless its inspector page is gone, which only a relaunch can fix', () => {
  assert.equal(recoveryFor('reading the router state: app evaluate threw: Error: no navigation state'), 'reload')
  assert.equal(recoveryFor('reading the router state: no answer in 5s'), 'reload')
  assert.equal(
    recoveryFor('reading the router state: no Metro inspector page for iPhoneTest (Metro lists nothing)'),
    'relaunch'
  )
  assert.equal(
    recoveryFor('reading the router state: inspector connection closed before answering'),
    'relaunch'
  )
})

test('the app pid is read from launchctl list, and a listed app with no pid is not running', () => {
  const out = [
    'PID\tStatus\tLabel',
    '412\t0\tcom.apple.springboard',
    '99507\t0\tUIKitApplication:keybase.ios[b613][rb-legacy]',
    '-\t0\tUIKitApplication:keybase.ios.share[aa][rb-legacy]',
  ].join('\n')
  assert.equal(pidFromLaunchctl(out, 'keybase.ios'), 99507)
  assert.equal(pidFromLaunchctl('-\t-9\tUIKitApplication:keybase.ios[b613][rb-legacy]', 'keybase.ios'), undefined)
  assert.equal(pidFromLaunchctl('412\t0\tcom.apple.springboard', 'keybase.ios'), undefined)
})

const sameRuntime = {tokenExpected: 'tok-1', tokenSeen: 'tok-1'}

test('a capture is taken again only when it lost the inspector page and the app process lived through it', () => {
  const dropped = 'switching to tabs.peopleTab: no Metro inspector page for iPhoneTest (Metro lists nothing)'
  // a socket drop: same process
  assert.equal(recaptureAfterDrop({firstError: dropped, pidAtDrop: 100, pidBefore: 100, ...sameRuntime}), true)
  assert.equal(recaptureAfterDrop({firstError: 'switching to tabs.peopleTab: inspector connection closed before answering', pidAtDrop: 100, pidBefore: 100, ...sameRuntime}), true)
  // the app died: killed or crashed, then nothing running, or something else started it again
  assert.equal(recaptureAfterDrop({firstError: dropped, pidAtDrop: undefined, pidBefore: 100, ...sameRuntime}), false)
  assert.equal(recaptureAfterDrop({firstError: dropped, pidAtDrop: 200, pidBefore: 100, ...sameRuntime}), false)
  // no pid to compare with
  assert.equal(recaptureAfterDrop({firstError: dropped, pidAtDrop: undefined, pidBefore: undefined, ...sameRuntime}), false)
  // a failure that is not a lost page
  assert.equal(recaptureAfterDrop({firstError: 'testID x did not appear after 10s', pidAtDrop: 100, pidBefore: 100, ...sameRuntime}), false)
  assert.equal(recaptureAfterDrop({firstError: 'switching to tabs.peopleTab: no answer in 5s', pidAtDrop: 100, pidBefore: 100, ...sameRuntime}), false)
  assert.equal(recaptureAfterDrop({firstError: undefined, pidAtDrop: 100, pidBefore: 100, ...sameRuntime}), false)
})

test('a capture that failed for a reason of its own before the page went is not taken again', () => {
  // the first error is the capture's own; the lost page only shows in what followed
  assert.equal(recaptureAfterDrop({firstError: 'testID settingsDisplay did not appear after 10s', pidAtDrop: 100, pidBefore: 100, ...sameRuntime}), false)
  // a capture that passed, then lost the page in the router check after it
  assert.equal(
    recaptureAfterDrop({
      firstError: 'the app was left broken (reading the router state: no Metro inspector page for iPhoneTest (Metro lists nothing)) and was relaunched',
      pidAtDrop: 100,
      pidBefore: 100,
      ...sameRuntime,
    }),
    true
  )
})

test('a capture is taken again only when the JS runtime at the drop is the one the run last marked', () => {
  const dropped = 'switching to tabs.peopleTab: inspector connection closed before answering'
  const same = {firstError: dropped, pidAtDrop: 100, pidBefore: 100}
  assert.equal(recaptureAfterDrop({...same, tokenExpected: 'tok-1', tokenSeen: 'tok-1'}), true)
  // the JS reloaded or crashed and restarted under the same pid: an unmarked runtime, or one marked
  // by a reload or relaunch the recovery did
  assert.equal(recaptureAfterDrop({...same, tokenExpected: 'tok-1', tokenSeen: null}), false)
  assert.equal(recaptureAfterDrop({...same, tokenExpected: 'tok-1', tokenSeen: 'tok-2'}), false)
  // never read back
  assert.equal(recaptureAfterDrop({...same, tokenExpected: 'tok-1', tokenSeen: undefined}), false)
  assert.equal(recaptureAfterDrop({...same, tokenExpected: undefined, tokenSeen: undefined}), false)
})

// Recovery deps that log each call; `routerAt` and `readToken` answer from the given lists in turn.
const recoverWith = (o: {drop?: boolean; restarted?: boolean; router?: Array<string | undefined>; token?: Array<boolean>}) => {
  const calls: Array<string> = []
  let restarted = false
  let dropped = !!o.drop
  const deps: RecoverDeps = {
    dropPending: () => dropped,
    noteDrop: () => {
      calls.push('noteDrop')
      dropped = true
    },
    readToken: async () => {
      calls.push('readToken')
      const back = o.token?.shift() ?? true
      if (back) restarted = !!o.restarted
      return Promise.resolve(back)
    },
    relaunch: async () => {
      calls.push('relaunch')
      return Promise.resolve()
    },
    reload: async () => {
      calls.push('reload')
      return Promise.resolve()
    },
    routerAt: async () => {
      calls.push('routerAt')
      const err = o.router?.shift()
      return err === undefined ? Promise.resolve() : Promise.reject(new Error(err))
    },
    runtimeRestarted: () => restarted,
  }
  return {calls, deps}
}
const LOST = 'reading the router state: no Metro inspector page for iPhoneTest (Metro lists nothing)'

test('a page back on a restarted runtime is reloaded into the prepared state, though its router is fine', async () => {
  const {calls, deps} = recoverWith({drop: true, restarted: true})
  const why = await recoverApp(deps)
  assert.deepEqual(calls, ['readToken', 'reload'])
  assert.match(why ?? '', /the JS runtime restarted while the inspector page was gone\) and was reloaded/)
  // and the entry stays failed: the runtime it reads back is not the one the run marked
  assert.equal(
    recaptureAfterDrop({firstError: LOST, pidAtDrop: 100, pidBefore: 100, tokenExpected: 'tok-1', tokenSeen: null}),
    false
  )
})

test('a page back on the same runtime with a working router needs nothing', async () => {
  const {calls, deps} = recoverWith({drop: true})
  assert.equal(await recoverApp(deps), undefined)
  assert.deepEqual(calls, ['readToken', 'routerAt'])
})

test('a page that does not come back after a drop is relaunched, without waiting on the router', async () => {
  const {calls, deps} = recoverWith({drop: true, token: [false]})
  assert.match((await recoverApp(deps)) ?? '', /the inspector page did not come back\) and was relaunched/)
  assert.deepEqual(calls, ['readToken', 'relaunch'])
})

test('a router check that loses the page notes the drop, and a restarted runtime behind it is reloaded', async () => {
  const {calls, deps} = recoverWith({restarted: true, router: [LOST]})
  assert.match((await recoverApp(deps)) ?? '', /and was reloaded/)
  assert.deepEqual(calls, ['routerAt', 'noteDrop', 'readToken', 'reload'])
})

test('a router check that loses the page goes on as a drop: the page back on the same runtime gets the router once more', async () => {
  const ok = recoverWith({router: [LOST]})
  assert.equal(await recoverApp(ok.deps), undefined)
  assert.deepEqual(ok.calls, ['routerAt', 'noteDrop', 'readToken', 'routerAt'])
  const broken = recoverWith({router: [LOST, 'reading the router state: app evaluate threw: Error: no navigation state']})
  assert.match((await recoverApp(broken.deps)) ?? '', /Metro lists nothing\); once the page was back: .*no navigation state\) and was reloaded/)
  assert.deepEqual(broken.calls, ['routerAt', 'noteDrop', 'readToken', 'routerAt', 'reload'])
  const gone = recoverWith({router: [LOST], token: [false]})
  assert.match((await recoverApp(gone.deps)) ?? '', /Metro lists nothing\); the inspector page did not come back\) and was relaunched/)
  assert.deepEqual(gone.calls, ['routerAt', 'noteDrop', 'readToken', 'relaunch'])
})

test('without a drop a working router needs nothing, and a broken one is reloaded', async () => {
  const ok = recoverWith({})
  assert.equal(await recoverApp(ok.deps), undefined)
  assert.deepEqual(ok.calls, ['routerAt'])
  const broken = recoverWith({router: ['reading the router state: app evaluate threw: Error: no navigation state']})
  assert.match((await recoverApp(broken.deps)) ?? '', /no navigation state\) and was reloaded/)
  assert.deepEqual(broken.calls, ['routerAt', 'reload'])
})

test('a relaunch that fails stops the run with one error', async () => {
  const {deps} = recoverWith({drop: true, token: [false]})
  deps.relaunch = async () => Promise.reject(new Error('activating the app: no answer in 30s'))
  await assert.rejects(recoverApp(deps), /a relaunch did not bring it back: activating the app: no answer in 30s/)
})
