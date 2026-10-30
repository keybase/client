import {fieldProblem, lengthEvalBody, secretEvalBody} from './secret-input-lib'

test('the secret is the last thing in the eval body, JSON-encoded once', () => {
  const body = secretEvalBody('f', 'p"w')
  const encoded = JSON.stringify('p"w')
  expect(body.split(encoded)).toHaveLength(2)
  expect(body.endsWith(`(${encoded})`)).toBe(true)
  expect(body.slice(0, body.lastIndexOf(encoded))).not.toContain('p"w')
  expect(body).toContain(JSON.stringify('f'))
})

test('the length read carries no text of its own and checks the same field', () => {
  expect(lengthEvalBody('f')).toContain(JSON.stringify('f'))
  expect(lengthEvalBody('f')).toContain('.length')
})

test('a failure names field ids only', () => {
  expect(fieldProblem('login-password-input', {focusedID: 'other-input', state: 'other field'})).toBe(
    'the focused text field is other-input, not login-password-input'
  )
  expect(fieldProblem('f', {state: 'nothing focused'})).toBe('no text field is focused; expected f')
  expect(fieldProblem('f', undefined)).toBe('the field f could not be read')
})

// The focused host field as RN 0.88's TextInput mounts it: the host fiber under a context provider
// under InternalTextInput, whose hooks run useRef, then useState for mostRecentEventCount,
// lastNativeText and lastNativeSelection. The fiber reached is the stale one of its pair: each
// useState hook's memoizedState is a render behind, and its shared queue holds the rendered state.
const focusedFieldRuntime = (props: Record<string, unknown>, lastNativeText: unknown, hooksShaped = true) => {
  const state = (s: unknown) => ({memoizedState: 'stale', queue: {lastRenderedState: s}})
  const hooks = [
    {memoizedState: {current: null}},
    state(3),
    state(lastNativeText),
    {memoizedState: hooksShaped ? {mostRecentEventCount: 3, selection: {end: -1, start: -1}} : {selection: null}},
    {memoizedState: {create: () => {}, deps: []}},
  ].reduceRight<unknown>((next, hook) => ({...hook, next}), null)
  const internal = {memoizedState: hooks, return: null, tag: 0}
  const host = {memoizedProps: {testID: 'f', ...props}, return: {return: internal, tag: 10}, tag: 5}
  const tis = {currentlyFocusedInput: () => ({__internalInstanceHandle: host})}
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return (body: string) => (new Function('kbModule', body) as (k: unknown) => unknown)(() => tis)
}

test('a controlled field reads the length of its value', () => {
  const run = focusedFieldRuntime({onChangeText: () => {}, value: 'abc'}, 'stale')
  expect(run(lengthEvalBody('f'))).toEqual({length: 3, state: 'read'})
})

test("a field with no value reads the length of TextInput's last native text", () => {
  expect(focusedFieldRuntime({onChangeText: () => {}}, 'abcd')(lengthEvalBody('f'))).toEqual({length: 4, state: 'read'})
  expect(focusedFieldRuntime({defaultValue: 'xy', onChangeText: () => {}}, undefined)(lengthEvalBody('f'))).toEqual({
    length: 2,
    state: 'read',
  })
  expect(focusedFieldRuntime({onChangeText: () => {}}, undefined)(lengthEvalBody('f'))).toEqual({length: 0, state: 'read'})
})

test('a field with no value and no TextInput text state is not read', () => {
  expect(focusedFieldRuntime({onChangeText: () => {}}, 'abcd', false)(lengthEvalBody('f'))).toEqual({state: 'no text state'})
})

test('a secret is put only into a field with a value prop', () => {
  const calls: Array<string> = []
  const onChangeText = (t: string) => void calls.push(t)
  expect(focusedFieldRuntime({onChangeText}, undefined)(secretEvalBody('f', 'pw'))).toEqual({state: 'uncontrolled'})
  expect(calls).toEqual([])
  expect(focusedFieldRuntime({onChangeText, value: ''}, '')(secretEvalBody('f', 'pw'))).toEqual({state: 'set'})
  expect(calls).toEqual(['pw'])
})
