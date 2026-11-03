// The Metro eval bodies that put a secret into the app's focused text input and read back how long
// the field's text is (never the text), and the messages a failure gives, built from field ids and
// lengths only.

export type FieldRead =
  | {
      state:
        | 'ambiguous TextInputState'
        | 'no TextInputState'
        | 'ambiguous text commands'
        | 'no text commands'
        | 'no fiber roots'
        | 'nothing focused'
        | 'focused field not in the tree'
        | 'focused field twice in the tree'
        | 'no onChangeText'
        | 'focus moved'
        | 'no sink'
        | 'no text state'
        | 'threw'
        | 'no field'
        | 'many fields'
        | 'focused'
        | 'ready'
    }
  | {state: 'other field'; focusedID: string}
  | {state: 'set'; secure: boolean}
  | {state: 'read'; length: number; text?: string}

// Where the eval that resolves the field leaves the one function that writes it, for the eval that
// carries the secret. It holds no secret, so one left behind (a transport failure before the
// secret's eval ran) is harmless, and the next check replaces it.
const SINK = 'globalThis.__kbE2ESecretSink'

// kbModule(name) as {m}, or as {read} the FieldRead a missing or ambiguous module gives (`what`
// names it).
const moduleOr = (name: string, what: string) => `(() => {
    try {
      return {m: kbModule(${JSON.stringify(name)})}
    } catch (e) {
      const message = String(e && e.message)
      if (message.startsWith('ambiguous module')) return {read: {state: 'ambiguous ${what}'}}
      if (message.startsWith('no module')) return {read: {state: 'no ${what}'}}
      throw e
    }
  })()`

// fibersMatching(match): the mounted fibers matching `match`, each with its ancestors nearest first,
// found by walking every root's current tree down from the top as React DevTools does; undefined
// when there is no DevTools hook. A fiber's .return can reach the stale fiber of its parent's pair,
// whose props and hooks are a render behind; the path the walk came down holds only current ones.
export const FIBER_WALK = `
  const fibersMatching = match => {
    const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (!hook || !hook.getFiberRoots) return undefined
    const found = []
    for (const rid of hook.renderers.keys()) {
      for (const root of hook.getFiberRoots(rid)) {
        const path = []
        const stack = [[root.current, 0]]
        while (stack.length) {
          const [f, depth] = stack.pop()
          path.length = depth
          path.push(f)
          if (match(f)) found.push({above: path.slice(0, depth).reverse(), field: f})
          if (f.sibling) stack.push([f.sibling, depth])
          if (f.child) stack.push([f.child, depth + 1])
        }
      }
    }
    return found
  }
`

// hostFibers(match): the mounted host fibers (tag 5) with props that match `match`, as fibersMatching.
const hostFibers = `${FIBER_WALK}
  const hostFibers = match => fibersMatching(f => f.tag === 5 && !!f.memoizedProps && match(f))
`

// handleFiber(inst): the host fiber RN's instance handle names, with its ancestors nearest first,
// in O(1) of the tree; undefined unless every link is current: each fiber among its parent's
// children and the top the root's current HostRoot (a handle or a .return can be a stale fiber of
// its pair, a render behind).
const handleFiber = `
  const handleFiber = inst => {
    const field = inst && inst.__internalInstanceHandle
    if (!field || field.tag !== 5 || !field.memoizedProps) return undefined
    const above = []
    for (let c = field, p = field.return; p; c = p, p = p.return) {
      let k = p.child
      while (k && k !== c) k = k.sibling
      if (!k) return undefined
      above.push(p)
      if (p.tag === 3) return p.stateNode && p.stateNode.current === p ? {above, field} : undefined
    }
    return undefined
  }
`

// resolveFocused(): the focused input's current host fiber as {above, field, inst, props} when it
// is the one with fieldTestID and hands its text to its screen, else {read} saying why not. The
// instance handle first; the walk of every root (hostFibers) only when that is not current.
const resolveFocused = (fieldTestID: string) => `${hostFibers}${handleFiber}
  const resolveFocused = () => {
    const tis = ${moduleOr('node_modules/react-native/Libraries/Components/TextInput/TextInputState.js', 'TextInputState')}
    if (tis.read) return tis
    const inst = (tis.m.default ?? tis.m).currentlyFocusedInput()
    if (!inst) return {read: {state: 'nothing focused'}}
    const fast = handleFiber(inst)
    const found = fast
      ? [fast]
      : hostFibers(f => f.stateNode === inst || !!(f.stateNode && f.stateNode.canonical && f.stateNode.canonical.publicInstance === inst))
    if (!found) return {read: {state: 'no fiber roots'}}
    if (found.length === 0) return {read: {state: 'focused field not in the tree'}}
    if (found.length > 1) return {read: {state: 'focused field twice in the tree'}}
    const {above, field} = found[0]
    const props = field.memoizedProps
    if (props.testID !== ${JSON.stringify(fieldTestID)}) return {read: {state: 'other field', focusedID: String(props.testID ?? '(no testID)')}}
    if (typeof props.onChangeText !== 'function' || typeof props.onChange !== 'function') return {read: {state: 'no onChangeText'}}
    return {above, field, inst, props}
  }
`

// The first of the two evals that put text into the focused field; it holds no secret. When the
// focused field is the one with fieldTestID it leaves a sink that, called with the text, checks the
// same input is still focused (focus can move between evals) and writes it the way a keystroke
// does, so a field with no value prop takes it too: the native field's text first (RN's own
// setTextAndSelection command at the event count the field is on, so the field shows it, as dots
// when secure), then TextInput's own onChange, which hands it to the screen's onChangeText and to
// TextInput's record of the native text. A controlled field's value then matches what the native
// field holds, so React sends the field nothing more.
export const prepareEvalBody = (fieldTestID: string) => `${resolveFocused(fieldTestID)}
  delete ${SINK}
  const first = resolveFocused()
  if (first.read) return first.read
  const commands = first.props.multiline
    ? ${moduleOr('node_modules/react-native/Libraries/Components/TextInput/RCTMultilineTextInputNativeComponent.js', 'text commands')}
    : ${moduleOr('node_modules/react-native/Libraries/Components/TextInput/RCTSingelineTextInputNativeComponent.js', 'text commands')}
  if (commands.read) return commands.read
  ${SINK} = text => {
    const now = resolveFocused()
    if (now.read) return now.read
    if (now.inst !== first.inst) return {state: 'focus moved'}
    const eventCount = now.props.mostRecentEventCount
    try {
      commands.m.Commands.setTextAndSelection(now.inst, eventCount, text, text.length, text.length)
      now.props.onChange({nativeEvent: {eventCount, text}})
    } catch {
      return {state: 'threw'}
    }
    return {state: 'set', secure: now.props.secureTextEntry === true}
  }
  return {state: 'ready'}`

// The eval that carries the secret: it takes the sink and calls it, and nothing else, so an error
// that quotes it quotes only this. The secret is the last thing in the body.
export const secretEvalBody = (secret: string) => `
  const sink = ${SINK}
  delete ${SINK}
  if (typeof sink !== 'function') return {state: 'no sink'}
  return sink(${JSON.stringify(secret)})`

// The focused field's text, when it is the field with fieldTestID: its value, or for a field with
// none, the text RN's TextInput last had from the native field (its lastNativeText state, the hook
// just before its {mostRecentEventCount, selection} one, in the nearest function component above the
// host field); before any edit that is its defaultValue. `answer` turns it into the eval's result.
const focusedTextBody = (fieldTestID: string, answer: string) => `${resolveFocused(fieldTestID)}
  const r = resolveFocused()
  if (r.read) return r.read
  const {above, props} = r
  const nativeText = () => {
    const f = above.slice(0, 8).find(a => a.tag === 0)
    for (let h = f && f.memoizedState; h && h.next; h = h.next) {
      const next = h.next.memoizedState
      if (next && typeof next === 'object' && 'mostRecentEventCount' in next && 'selection' in next) {
        if (h.memoizedState == null) return typeof props.defaultValue === 'string' ? props.defaultValue : ''
        return String(h.memoizedState)
      }
    }
    return undefined
  }
  const text = typeof props.value === 'string' ? props.value : nativeText()
  return text === undefined ? {state: 'no text state'} : ${answer}`

// How long the focused field's text is (focusedTextBody), never the text itself: for a secret field.
export const lengthEvalBody = (fieldTestID: string) => focusedTextBody(fieldTestID, "{state: 'read', length: text.length}")

// The focused field's text (focusedTextBody), for a field that holds no secret (a file's name being
// edited in a row whose one accessible element hides the field from XCUITest).
export const textEvalBody = (fieldTestID: string) => focusedTextBody(fieldTestID, "{state: 'read', length: text.length, text}")

// Focuses the one mounted text input with fieldTestID through its own focus(), as a tap would (an
// XCUITest tap on a secure field does not always take).
export const focusEvalBody = (fieldTestID: string) => `${hostFibers}
  const found = hostFibers(f => f.memoizedProps.testID === ${JSON.stringify(fieldTestID)})
  if (!found) return {state: 'no fiber roots'}
  if (found.length > 1) return {state: 'many fields'}
  const node = found[0] && found[0].field.stateNode
  const inst = node && ((node.canonical && node.canonical.publicInstance) || node)
  if (!inst || typeof inst.focus !== 'function') return {state: 'no field'}
  inst.focus()
  return {state: 'focused'}`

// What XCUITest reads a secure field's text as: one dot per character.
export const secureDots = (length: number) => '•'.repeat(length)

export const fieldProblem = (fieldTestID: string, r: FieldRead | undefined): string => {
  switch (r?.state) {
    case 'no TextInputState':
      return `the app's TextInputState module was not found, so the focused field ${fieldTestID} could not be checked`
    case 'ambiguous TextInputState':
      return `the app has more than one TextInputState module, so the focused field ${fieldTestID} could not be checked`
    case 'no text commands':
      return `the app's TextInput native commands module was not found, so ${fieldTestID} could not be set`
    case 'ambiguous text commands':
      return `the app has more than one TextInput native commands module, so ${fieldTestID} could not be set`
    case 'no fiber roots':
      return `the app has no React DevTools hook to list its fiber roots, so ${fieldTestID} could not be found`
    case 'nothing focused':
      return `no text field is focused; expected ${fieldTestID}`
    case 'focused field not in the tree':
      return `the focused text field is in no mounted React tree; expected ${fieldTestID}`
    case 'focused field twice in the tree':
      return `the focused text field is in the React tree twice; expected ${fieldTestID} once`
    case 'other field':
      return `the focused text field is ${r.focusedID}, not ${fieldTestID}`
    case 'no onChangeText':
      return `the focused field ${fieldTestID} takes no onChangeText or no onChange`
    case 'focus moved':
      return `the focus moved off ${fieldTestID} between checking it and setting it`
    case 'no sink':
      return `the check of ${fieldTestID} left nothing to set it with`
    case 'no text state':
      return `the focused field ${fieldTestID} has no value prop and no TextInput text state to read`
    case 'no field':
      return `no text input with testID ${fieldTestID} is mounted`
    case 'many fields':
      return `more than one text input with testID ${fieldTestID} is mounted`
    case 'threw':
      return `setting the focused field ${fieldTestID} threw`
    case 'set':
    case 'read':
    case 'focused':
    case 'ready':
      return `the field ${fieldTestID} answered ${r.state}`
    case undefined:
      return `the field ${fieldTestID} could not be read`
  }
}

export type ProvisionSubmit = {
  state: 'no provision flow' | 'ambiguous provision flow' | 'no submit' | 'ready' | 'no sink' | 'threw' | 'submitted'
}

// The first of the two evals that hand a provisioning phrase to the app's code page; it holds no
// secret. It leaves a sink that calls the app's own submitProvisionTextCode, the handler its QR
// scanner calls with what it read (provision/code-page/qr-scan/hooks.tsx), for secretEvalBody.
export const provisionPrepareEvalBody = () => `
  delete ${SINK}
  const flow = ${moduleOr('provision/flow.tsx', 'provision flow')}
  if (flow.read) return flow.read
  const submit = flow.m.submitProvisionTextCode
  if (typeof submit !== 'function') return {state: 'no submit'}
  ${SINK} = code => {
    try {
      submit(code)
    } catch {
      return {state: 'threw'}
    }
    return {state: 'submitted'}
  }
  return {state: 'ready'}`

export const provisionProblem = (r: ProvisionSubmit | undefined): string => {
  switch (r?.state) {
    case 'no provision flow':
      return "the app's provision/flow.tsx module was not found, so the phrase could not be submitted"
    case 'ambiguous provision flow':
      return 'the app has more than one provision/flow.tsx module, so the phrase could not be submitted'
    case 'no submit':
      return 'provision/flow.tsx has no submitProvisionTextCode'
    case 'no sink':
      return 'the check of the code page left nothing to submit the phrase with'
    case 'threw':
      return 'submitting the phrase threw'
    case 'ready':
    case 'submitted':
      return `submitting the phrase answered ${r.state}`
    case undefined:
      return 'submitting the phrase got no answer'
  }
}
