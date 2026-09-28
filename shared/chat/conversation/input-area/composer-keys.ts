// Which keys the composer reacts to, and in what order of precedence. Pure: each platform
// gathers the facts, asks composerKeyDown, then carries out the actions it gets back.

export type ComposerKey = {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

// 'empty' is a list open with no items yet (a lookup loading, or nothing matching); 'unfiltered'
// is a list opened on a bare marker (`@`), before anything was typed after it
export type Suggestions = 'none' | 'empty' | 'unfiltered' | 'filtered'

type ThreadFacts = {
  editing: boolean
  replying: boolean
  textEmpty: boolean
}

// a key in the desktop composer's own textarea
export type InputKeyState = ThreadFacts & {source: 'input'; suggestions: Suggestions}
// a key anywhere else in the desktop window
export type WindowKeyState = ThreadFacts & {
  source: 'window'
  keypress: boolean
  // typing into some other input or textarea on the page
  targetIsInput: boolean
}
// a mobile hardware keyboard, which only ever reports enter and shift-enter
export type HardwareKeyState = {source: 'hardware'}
export type ComposerKeyState = InputKeyState | WindowKeyState | HardwareKeyState

type ThreadKeyAction =
  | {type: 'editLast'}
  | {type: 'cancelEdit'}
  | {type: 'cancelReply'}
  | {type: 'openFilePicker'}
  | {type: 'scrollUp'}
  | {type: 'scrollDown'}
export type InputKeyAction =
  | ThreadKeyAction
  | {type: 'recheckSuggestions'}
  | {type: 'suggestionMove'; up: boolean}
  // orSubmit: send instead when the list has nothing highlighted to pick
  | {type: 'suggestionSelect'; orSubmit: boolean}
  | {type: 'submit'}
export type WindowKeyAction = ThreadKeyAction | {type: 'focusInput'}
export type HardwareKeyAction = {type: 'submit'} | {type: 'newline'}
export type ComposerKeyAction = InputKeyAction | WindowKeyAction | HardwareKeyAction

// actions run in order, after the default is prevented
export type ComposerKeyResult<A extends ComposerKeyAction> = {
  actions: ReadonlyArray<A>
  preventDefault: boolean
}

const ignored = {actions: [], preventDefault: false} as const

const threadKey = (s: ThreadFacts, k: ComposerKey): ComposerKeyResult<ThreadKeyAction> | undefined => {
  if (k.key === 'ArrowUp' && !s.editing && s.textEmpty) {
    return {actions: [{type: 'editLast'}], preventDefault: true}
  }
  if (k.key === 'Escape' && s.editing) {
    return {actions: [{type: 'cancelEdit'}], preventDefault: false}
  }
  if (k.key === 'Escape' && s.replying) {
    return {actions: [{type: 'cancelReply'}], preventDefault: false}
  }
  if (k.key === 'u' && (k.ctrlKey || k.metaKey)) {
    return {actions: [{type: 'openFilePicker'}], preventDefault: false}
  }
  if (k.key === 'PageDown') {
    return {actions: [{type: 'scrollDown'}], preventDefault: false}
  }
  if (k.key === 'PageUp') {
    return {actions: [{type: 'scrollUp'}], preventDefault: false}
  }
  return undefined
}

const isSendEnter = (k: ComposerKey) => k.key === 'Enter' && !(k.altKey || k.ctrlKey || k.metaKey || k.shiftKey)

// The keys an open suggestion list takes, ahead of everything else. It claims the keys that move
// through it even before it has items, as it always has, so a key pressed while it loads neither
// moves the caret nor takes focus out of the composer; there is just nothing to move to. Enter
// has nothing to pick then, so it sends.
const suggestionKey = (suggestions: Suggestions, k: ComposerKey): ComposerKeyResult<InputKeyAction> | undefined => {
  if (suggestions === 'none') return undefined
  const hasItems = suggestions !== 'empty'
  const claim = (action?: InputKeyAction) => ({actions: action ? [action] : [], preventDefault: true})
  switch (k.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      return claim(hasItems ? {type: 'suggestionMove', up: k.key === 'ArrowUp'} : undefined)
    case 'Enter':
      return hasItems && isSendEnter(k) ? claim({orSubmit: true, type: 'suggestionSelect'}) : undefined
    case 'Tab':
      return claim(
        !hasItems
          ? undefined
          : suggestions === 'filtered'
            ? {orSubmit: false, type: 'suggestionSelect'}
            : {type: 'suggestionMove', up: k.shiftKey}
      )
    default:
      return undefined
  }
}

const inputKey = (s: InputKeyState, k: ComposerKey): ComposerKeyResult<InputKeyAction> => {
  const list = suggestionKey(s.suggestions, k)
  if (list) return list

  const thread = threadKey(s, k)
  const actions: Array<InputKeyAction> = [...(thread?.actions ?? [])]
  let preventDefault = thread?.preventDefault ?? false

  if (k.key === 'ArrowLeft' || k.key === 'ArrowRight') {
    actions.push({type: 'recheckSuggestions'})
  }

  if (isSendEnter(k)) {
    actions.push({type: 'submit'})
    preventDefault = true
  }
  return {actions, preventDefault}
}

const focusKeys = new Set(['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'])

const windowKey = (s: WindowKeyState, k: ComposerKey): ComposerKeyResult<WindowKeyAction> => {
  if (s.targetIsInput) return ignored
  const thread = threadKey(s, k)
  if (thread) return thread
  const isPaste = k.key === 'v' && (k.ctrlKey || k.metaKey)
  if (s.keypress || isPaste || focusKeys.has(k.key)) {
    return {actions: [{type: 'focusInput'}], preventDefault: false}
  }
  return ignored
}

const hardwareKey = (k: ComposerKey): ComposerKeyResult<HardwareKeyAction> => {
  if (k.key !== 'Enter') return ignored
  return {actions: [k.shiftKey ? {type: 'newline'} : {type: 'submit'}], preventDefault: false}
}

export function composerKeyDown(s: InputKeyState, k: ComposerKey): ComposerKeyResult<InputKeyAction>
export function composerKeyDown(s: WindowKeyState, k: ComposerKey): ComposerKeyResult<WindowKeyAction>
export function composerKeyDown(s: HardwareKeyState, k: ComposerKey): ComposerKeyResult<HardwareKeyAction>
export function composerKeyDown(s: ComposerKeyState, k: ComposerKey): ComposerKeyResult<ComposerKeyAction> {
  switch (s.source) {
    case 'input':
      return inputKey(s, k)
    case 'window':
      return windowKey(s, k)
    case 'hardware':
      return hardwareKey(k)
  }
}

const noModifiers = {altKey: false, ctrlKey: false, metaKey: false, shiftKey: false}

// the native side names hardware keys 'enter' and 'shift-enter'
export const keyFromHardware = (pressedKey: string): ComposerKey => {
  switch (pressedKey) {
    case 'enter':
      return {...noModifiers, key: 'Enter'}
    case 'shift-enter':
      return {...noModifiers, key: 'Enter', shiftKey: true}
    default:
      return {...noModifiers, key: pressedKey}
  }
}
