// The Metro eval bodies that put a secret into the app's focused text input and read back how long
// the field's text is (never the text), and the messages a failure gives, built from field ids and
// lengths only.

export type FieldRead =
  | {
      state:
        | 'ambiguous TextInputState'
        | 'no TextInputState'
        | 'nothing focused'
        | 'no onChangeText'
        | 'uncontrolled'
        | 'no text state'
        | 'threw'
        | 'no field'
        | 'many fields'
        | 'focused'
    }
  | {state: 'other field'; focusedID: string}
  | {state: 'set'}
  | {state: 'read'; length: number}

const focusedField = (fieldTestID: string) => `
  let tis
  try {
    tis = kbModule('node_modules/react-native/Libraries/Components/TextInput/TextInputState.js')
  } catch (e) {
    const message = String(e && e.message)
    if (message.startsWith('ambiguous module')) return {state: 'ambiguous TextInputState'}
    if (message.startsWith('no module')) return {state: 'no TextInputState'}
    throw e
  }
  const focused = (tis.default ?? tis).currentlyFocusedInput()
  const field = focused && focused.__internalInstanceHandle
  if (!field || !field.memoizedProps) return {state: 'nothing focused'}
  const props = field.memoizedProps
  if (props.testID !== ${JSON.stringify(fieldTestID)}) return {state: 'other field', focusedID: String(props.testID ?? '(no testID)')}
  if (typeof props.onChangeText !== 'function') return {state: 'no onChangeText'}
`

// Sets the focused field's text through its own onChangeText (the React state that controls it, so
// the native field shows it too), only when the focused field is the one with fieldTestID. A field
// with no value prop is refused: its onChangeText would change the screen's state, never the native
// field. The secret is the last thing in the body: whatever names a part of the body names its start.
export const secretEvalBody = (fieldTestID: string, secret: string) => `${focusedField(fieldTestID)}
  if (typeof props.value !== 'string') return {state: 'uncontrolled'}
  return (text => {
    try {
      props.onChangeText(text)
    } catch {
      return {state: 'threw'}
    }
    return {state: 'set'}
  })(${JSON.stringify(secret)})`

// How long the focused field's text is, when it is the field with fieldTestID: its value, or for a
// field with none, the text RN's TextInput last had from the native field (its lastNativeText state,
// the hook just before its {mostRecentEventCount, selection} one, in the nearest function component
// above the host field); before any edit that is its defaultValue. The state is read from the hook's
// update queue, which both fibers of a component share: the fiber the host field's .return reaches
// can be the stale one of the pair, whose memoizedState is a render behind.
export const lengthEvalBody = (fieldTestID: string) => `${focusedField(fieldTestID)}
  const nativeLength = () => {
    let f = field.return
    for (let i = 0; f && f.tag !== 0 && i < 8; i++) f = f.return
    for (let h = f && f.memoizedState; h && h.next; h = h.next) {
      const next = h.next.memoizedState
      if (next && typeof next === 'object' && 'mostRecentEventCount' in next && 'selection' in next) {
        const text = h.queue && 'lastRenderedState' in h.queue ? h.queue.lastRenderedState : h.memoizedState
        if (text == null) return typeof props.defaultValue === 'string' ? props.defaultValue.length : 0
        return String(text).length
      }
    }
    return undefined
  }
  const length = typeof props.value === 'string' ? props.value.length : nativeLength()
  return length === undefined ? {state: 'no text state'} : {state: 'read', length}`

// Focuses the one mounted text input with fieldTestID through its own focus(), as a tap would (an
// XCUITest tap on a secure field does not always take).
export const focusEvalBody = (fieldTestID: string) => `
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook || !hook.getFiberRoots) return {state: 'no field'}
  const found = []
  for (const rid of hook.renderers.keys()) {
    for (const root of hook.getFiberRoots(rid)) {
      const stack = [root.current]
      while (stack.length) {
        const f = stack.pop()
        if (f.tag === 5 && f.memoizedProps && f.memoizedProps.testID === ${JSON.stringify(fieldTestID)}) found.push(f)
        if (f.child) stack.push(f.child)
        if (f.sibling) stack.push(f.sibling)
      }
    }
  }
  if (found.length > 1) return {state: 'many fields'}
  const inst = found[0] && ((found[0].stateNode && found[0].stateNode.canonical && found[0].stateNode.canonical.publicInstance) || found[0].stateNode)
  if (!inst || typeof inst.focus !== 'function') return {state: 'no field'}
  inst.focus()
  return {state: 'focused'}`

// Empties the focused field, when it is the one with fieldTestID.
export const emptyEvalBody = (fieldTestID: string) => secretEvalBody(fieldTestID, '')

export const fieldProblem = (fieldTestID: string, r: FieldRead | undefined): string => {
  switch (r?.state) {
    case 'no TextInputState':
      return `the app's TextInputState module was not found, so the focused field ${fieldTestID} could not be checked`
    case 'ambiguous TextInputState':
      return `the app has more than one TextInputState module, so the focused field ${fieldTestID} could not be checked`
    case 'nothing focused':
      return `no text field is focused; expected ${fieldTestID}`
    case 'other field':
      return `the focused text field is ${r.focusedID}, not ${fieldTestID}`
    case 'no onChangeText':
      return `the focused field ${fieldTestID} takes no onChangeText`
    case 'uncontrolled':
      return `the focused field ${fieldTestID} takes no value prop, so its onChangeText would not reach the native field`
    case 'no text state':
      return `the focused field ${fieldTestID} has no value prop and no TextInput text state to read`
    case 'no field':
      return `no text input with testID ${fieldTestID} is mounted`
    case 'many fields':
      return `more than one text input with testID ${fieldTestID} is mounted`
    case 'threw':
      return `the focused field ${fieldTestID}'s onChangeText threw`
    case 'set':
    case 'read':
    case 'focused':
      return `the field ${fieldTestID} answered ${r.state}`
    case undefined:
      return `the field ${fieldTestID} could not be read`
  }
}

