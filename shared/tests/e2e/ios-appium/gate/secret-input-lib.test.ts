import {fieldProblem, focusEvalBody, lengthEvalBody, prepareEvalBody, secretEvalBody, secureDots} from './secret-input-lib'

test('the secret is the last thing in its eval body, JSON-encoded once, and the check before it holds none', () => {
  const body = secretEvalBody('p"w')
  const encoded = JSON.stringify('p"w')
  expect(body.split(encoded)).toHaveLength(2)
  expect(body.trimEnd().endsWith(`sink(${encoded})`)).toBe(true)
  expect(body.slice(0, body.lastIndexOf(encoded))).not.toContain('p"w')
  // the field check is a function of the field id alone
  expect(prepareEvalBody.length).toBe(1)
  expect(prepareEvalBody('f')).toContain(JSON.stringify('f'))
})

test('a failure names field ids only', () => {
  expect(fieldProblem('login-password-input', {focusedID: 'other-input', state: 'other field'})).toBe(
    'the focused text field is other-input, not login-password-input'
  )
  expect(fieldProblem('f', {state: 'nothing focused'})).toBe('no text field is focused; expected f')
  expect(fieldProblem('f', {state: 'focus moved'})).toBe('the focus moved off f between checking it and setting it')
  expect(fieldProblem('f', undefined)).toBe('the field f could not be read')
})

test('a secure field reads as one dot per character', () => {
  expect(secureDots(3)).toBe('•••')
})

// A focused text input as RN 0.88's TextInput mounts it under Fabric: the host fiber under a context
// provider under InternalTextInput, whose hooks run useRef, then useState for mostRecentEventCount,
// lastNativeText and lastNativeSelection. Each fiber has a stale alternate a render behind; the
// focused instance's own handle and the fibers' .return lead into the stale ones, and only the walk
// down from the root's current tree reaches the current fibers. The current onChange does what
// TextInput's _onChange does: the screen's onChangeText, then lastNativeText.
type Hook = {memoizedState: unknown; next: Hook | null}
type Fiber = {
  child?: Fiber
  memoizedProps?: Record<string, unknown>
  memoizedState?: Hook | null
  return?: Fiber
  sibling?: Fiber
  stateNode?: unknown
  tag: number
}
type Globals = {__kbE2ESecretSink?: unknown; __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown}

const hooks = (lastNativeText: unknown): Hook =>
  [{current: null}, 3, lastNativeText, {mostRecentEventCount: 3, selection: {end: -1, start: -1}}, {deps: []}].reduceRight<Hook | null>(
    (next, memoizedState) => ({memoizedState, next}),
    null
  ) as Hook

const makeApp = (opts: {controlledValue?: string} = {}) => {
  const focused: {current: unknown} = {current: undefined}
  const inst = {focus: () => (focused.current = inst)}
  const other = {focus: () => {}}
  focused.current = inst
  const commandCalls: Array<Array<unknown>> = []
  const screenGot: Array<string> = []
  const internal: Fiber = {memoizedState: hooks(undefined), tag: 0}
  const staleInternal: Fiber = {memoizedState: hooks('stale text'), tag: 0}
  const provider: Fiber = {return: staleInternal, tag: 10}
  const staleProvider: Fiber = {return: staleInternal, tag: 10}
  const props = (current: boolean) => ({
    mostRecentEventCount: 3,
    onChange: (e: {nativeEvent: {eventCount: number; text: string}}) => {
      if (!current) throw new Error('a stale onChange ran')
      screenGot.push(e.nativeEvent.text)
      const lastNativeText = (internal.memoizedState as Hook).next?.next
      if (lastNativeText) lastNativeText.memoizedState = e.nativeEvent.text
    },
    onChangeText: () => {},
    secureTextEntry: true,
    testID: 'f',
    ...(opts.controlledValue === undefined ? {} : {value: opts.controlledValue}),
  })
  const stateNode = {canonical: {publicInstance: inst}}
  const host: Fiber = {memoizedProps: props(true), return: staleProvider, stateNode, tag: 5}
  const staleHost: Fiber = {memoizedProps: props(false), return: staleProvider, stateNode, tag: 5}
  const otherHost: Fiber = {memoizedProps: {onChange: () => {}, onChangeText: () => {}, testID: 'g'}, stateNode: {canonical: {publicInstance: other}}, tag: 5}
  internal.child = provider
  provider.child = host
  host.sibling = otherHost
  const root = {current: {child: internal, tag: 3} as Fiber}
  Object.assign(inst, {__internalInstanceHandle: staleHost})
  ;(globalThis as Globals).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {getFiberRoots: () => [root], renderers: new Map([[1, {}]])}
  const modules: Record<string, unknown> = {
    'node_modules/react-native/Libraries/Components/TextInput/RCTSingelineTextInputNativeComponent.js': {
      Commands: {setTextAndSelection: (...args: Array<unknown>) => commandCalls.push(args)},
    },
    'node_modules/react-native/Libraries/Components/TextInput/TextInputState.js': {currentlyFocusedInput: () => focused.current},
  }
  const kbModule = (name: string) => {
    if (!(name in modules)) throw new Error('no module ' + name)
    return modules[name]
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = (body: string) => (new Function('kbModule', body) as (k: unknown) => unknown)(kbModule)
  return {commandCalls, focused, inst, other, run, screenGot}
}

afterEach(() => {
  const g = globalThis as Globals
  delete g.__REACT_DEVTOOLS_GLOBAL_HOOK__
  delete g.__kbE2ESecretSink
})

test('a field with no value prop takes the text natively and through its current onChange', () => {
  const app = makeApp()
  expect(app.run(lengthEvalBody('f'))).toEqual({length: 0, state: 'read'})
  expect(app.run(prepareEvalBody('f'))).toEqual({state: 'ready'})
  expect(app.run(secretEvalBody('pw'))).toEqual({secure: true, state: 'set'})
  expect(app.commandCalls).toEqual([[app.inst, 3, 'pw', 2, 2]])
  expect(app.screenGot).toEqual(['pw'])
  expect(app.run(lengthEvalBody('f'))).toEqual({length: 2, state: 'read'})
  // the sink is taken: a second secret eval sets nothing
  expect(app.run(secretEvalBody('pw'))).toEqual({state: 'no sink'})
  expect(app.commandCalls).toHaveLength(1)
})

test('a controlled field reads the length of its value', () => {
  expect(makeApp({controlledValue: 'abc'}).run(lengthEvalBody('f'))).toEqual({length: 3, state: 'read'})
})

test('focus that moved between the check and the secret leaves the field unset', () => {
  const app = makeApp()
  expect(app.run(prepareEvalBody('f'))).toEqual({state: 'ready'})
  app.focused.current = app.other
  expect(app.run(secretEvalBody('pw'))).toEqual({focusedID: 'g', state: 'other field'})
  expect(app.commandCalls).toEqual([])
  expect(app.screenGot).toEqual([])
})

test('another focused field, or none, is refused before any secret is sent', () => {
  const app = makeApp()
  expect(app.run(prepareEvalBody('h'))).toEqual({focusedID: 'f', state: 'other field'})
  expect(app.run(secretEvalBody('pw'))).toEqual({state: 'no sink'})
  app.focused.current = null
  expect(app.run(prepareEvalBody('f'))).toEqual({state: 'nothing focused'})
  expect(app.commandCalls).toEqual([])
})

test('a focused input outside the mounted tree is refused', () => {
  const app = makeApp()
  app.focused.current = {focus: () => {}}
  expect(app.run(prepareEvalBody('f'))).toEqual({state: 'focused field not in the tree'})
})

test('the focus eval focuses the one field with the id', () => {
  const app = makeApp()
  app.focused.current = null
  expect(app.run(focusEvalBody('f'))).toEqual({state: 'focused'})
  expect(app.focused.current).toBe(app.inst)
  expect(app.run(focusEvalBody('nope'))).toEqual({state: 'no field'})
})
