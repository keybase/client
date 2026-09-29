/// <reference types="jest" />
import {
  composerKeyDown,
  keyFromHardware,
  type ComposerKey,
  type ComposerKeyAction,
  type InputKeyState,
  type Suggestions,
  type WindowKeyState,
} from './composer-keys'

type Mods = Partial<Pick<ComposerKey, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>>
const k = (key: string, mods: Mods = {}): ComposerKey => ({
  altKey: false,
  ctrlKey: false,
  key,
  metaKey: false,
  shiftKey: false,
  ...mods,
})
const input = (o: Partial<InputKeyState> = {}): InputKeyState => ({
  editing: false,
  replying: false,
  source: 'input',
  suggestions: 'none',
  textEmpty: true,
  ...o,
})
const win = (o: Partial<WindowKeyState> = {}): WindowKeyState => ({
  editing: false,
  keypress: false,
  replying: false,
  source: 'window',
  targetIsInput: false,
  textEmpty: true,
  ...o,
})

const editLast = {type: 'editLast'} as const
const cancelEdit = {type: 'cancelEdit'} as const
const cancelReply = {type: 'cancelReply'} as const
const openFilePicker = {type: 'openFilePicker'} as const
const scrollUp = {type: 'scrollUp'} as const
const scrollDown = {type: 'scrollDown'} as const
const recheck = {type: 'recheckSuggestions'} as const
const moveUp = {type: 'suggestionMove', up: true} as const
const moveDown = {type: 'suggestionMove', up: false} as const
const pickOrSend = {orSubmit: true, type: 'suggestionSelect'} as const
const pick = {orSubmit: false, type: 'suggestionSelect'} as const
const submit = {type: 'submit'} as const
const newline = {type: 'newline'} as const
const focusInput = {type: 'focusInput'} as const

type Row = [string, InputKeyState, ComposerKey, ReadonlyArray<ComposerKeyAction>, boolean]

describe('the composer textarea', () => {
  const withText = {textEmpty: false}
  const open: Suggestions = 'filtered'
  const rows: Array<Row> = [
    // ArrowUp
    ['ArrowUp, empty: edit the last message', input(), k('ArrowUp'), [editLast], true],
    ['ArrowUp, text: the caret moves', input(withText), k('ArrowUp'), [], false],
    ['ArrowUp, empty, editing: the caret moves', input({editing: true}), k('ArrowUp'), [], false],
    ['ArrowUp, empty, replying: still edits', input({replying: true}), k('ArrowUp'), [editLast], true],
    ['ArrowUp with modifiers still edits', input(), k('ArrowUp', {shiftKey: true}), [editLast], true],
    ['ArrowUp, text, list open: move up', input({...withText, suggestions: open}), k('ArrowUp'), [moveUp], true],
    [
      'ArrowUp, empty, list open: edit and move up',
      input({suggestions: open}),
      k('ArrowUp'),
      [editLast, moveUp],
      true,
    ],
    [
      'ArrowUp, editing, list open: move up only',
      input({editing: true, suggestions: open}),
      k('ArrowUp'),
      [moveUp],
      true,
    ],
    // ArrowDown
    ['ArrowDown, no list: nothing', input(withText), k('ArrowDown'), [], false],
    ['ArrowDown, list open: move down', input({suggestions: open}), k('ArrowDown'), [moveDown], true],
    [
      'ArrowDown, unfiltered list: move down',
      input({suggestions: 'unfiltered'}),
      k('ArrowDown'),
      [moveDown],
      true,
    ],
    [
      'ArrowUp, list open with no items yet: claimed, nothing moves',
      input({...withText, suggestions: 'empty'}),
      k('ArrowUp'),
      [],
      true,
    ],
    [
      'ArrowDown, list open with no items yet: claimed, nothing moves',
      input({suggestions: 'empty'}),
      k('ArrowDown'),
      [],
      true,
    ],
    // Enter
    ['Enter: send', input(withText), k('Enter'), [submit], true],
    ['Enter, list open with no items yet: send', input({suggestions: 'empty'}), k('Enter'), [submit], true],
    ['Enter, empty: still asks to send', input(), k('Enter'), [submit], true],
    ['Enter, editing: send', input({...withText, editing: true}), k('Enter'), [submit], true],
    ['ctrl-Enter: send', input(withText), k('Enter', {ctrlKey: true}), [submit], true],
    ['shift-Enter: newline by the browser', input(withText), k('Enter', {shiftKey: true}), [], false],
    ['alt-Enter: newline by the browser', input(withText), k('Enter', {altKey: true}), [], false],
    ['meta-Enter: nothing', input(withText), k('Enter', {metaKey: true}), [], false],
    [
      'ctrl-shift-Enter: shift wins',
      input(withText),
      k('Enter', {ctrlKey: true, shiftKey: true}),
      [],
      false,
    ],
    ['Enter, list open: pick, else send', input({suggestions: open}), k('Enter'), [pickOrSend], true],
    [
      'Enter, unfiltered list: pick, else send',
      input({suggestions: 'unfiltered'}),
      k('Enter'),
      [pickOrSend],
      true,
    ],
    [
      'ctrl-Enter, list open: pick, else send',
      input({suggestions: open}),
      k('Enter', {ctrlKey: true}),
      [pickOrSend],
      true,
    ],
    ['shift-Enter, list open: nothing', input({suggestions: open}), k('Enter', {shiftKey: true}), [], false],
    ['alt-Enter, list open: nothing', input({suggestions: open}), k('Enter', {altKey: true}), [], false],
    ['meta-Enter, list open: nothing', input({suggestions: open}), k('Enter', {metaKey: true}), [], false],
    // Tab
    ['Tab, no list: focus moves on', input(withText), k('Tab'), [], false],
    ['Tab, filtered list: pick', input({suggestions: 'filtered'}), k('Tab'), [pick], true],
    [
      'shift-Tab, filtered list: pick',
      input({suggestions: 'filtered'}),
      k('Tab', {shiftKey: true}),
      [pick],
      true,
    ],
    ['Tab, unfiltered list: move down', input({suggestions: 'unfiltered'}), k('Tab'), [moveDown], true],
    [
      'shift-Tab, unfiltered list: move up',
      input({suggestions: 'unfiltered'}),
      k('Tab', {shiftKey: true}),
      [moveUp],
      true,
    ],
    ['Tab, list open with no items yet: claimed, focus stays', input({suggestions: 'empty'}), k('Tab'), [], true],
    [
      'shift-Tab, list open with no items yet: claimed, focus stays',
      input({suggestions: 'empty'}),
      k('Tab', {shiftKey: true}),
      [],
      true,
    ],
    // Escape
    ['Escape, editing: cancel the edit', input({editing: true}), k('Escape'), [cancelEdit], false],
    ['Escape, replying: cancel the reply', input({replying: true}), k('Escape'), [cancelReply], false],
    [
      'Escape, editing a reply: cancel the edit only',
      input({editing: true, replying: true}),
      k('Escape'),
      [cancelEdit],
      false,
    ],
    ['Escape, neither: nothing', input(withText), k('Escape'), [], false],
    [
      'Escape, editing, list open: cancel the edit',
      input({editing: true, suggestions: open}),
      k('Escape'),
      [cancelEdit],
      false,
    ],
    ['Escape, list open only: nothing', input({suggestions: open}), k('Escape'), [], false],
    [
      'Escape, editing, list open with no items yet: cancel the edit',
      input({editing: true, suggestions: 'empty'}),
      k('Escape'),
      [cancelEdit],
      false,
    ],
    // other thread keys
    ['ctrl-U: file picker', input(withText), k('u', {ctrlKey: true}), [openFilePicker], false],
    ['cmd-U: file picker', input(withText), k('u', {metaKey: true}), [openFilePicker], false],
    ['u: typed', input(withText), k('u'), [], false],
    ['ctrl-shift-U (key U): nothing', input(withText), k('U', {ctrlKey: true, shiftKey: true}), [], false],
    ['PageUp: scroll up', input(withText), k('PageUp'), [scrollUp], false],
    ['PageDown: scroll down', input(withText), k('PageDown'), [scrollDown], false],
    ['PageUp, list open: scroll up', input({suggestions: open}), k('PageUp'), [scrollUp], false],
    [
      'ctrl-U, list open: file picker',
      input({suggestions: open}),
      k('u', {ctrlKey: true}),
      [openFilePicker],
      false,
    ],
    // caret moves
    ['ArrowLeft: re-check suggestions', input(withText), k('ArrowLeft'), [recheck], false],
    ['ArrowRight: re-check suggestions', input(withText), k('ArrowRight'), [recheck], false],
    ['ArrowLeft, list open: re-check', input({suggestions: open}), k('ArrowLeft'), [recheck], false],
    ['a letter: nothing', input(withText), k('a'), [], false],
    ['a letter, list open: nothing', input({suggestions: open}), k('a'), [], false],
  ]

  test.each(rows)('%s', (_name, state, key, actions, preventDefault) => {
    expect(composerKeyDown(state, key)).toEqual({actions, preventDefault})
  })
})

describe('window keys', () => {
  type WinRow = [string, WindowKeyState, ComposerKey, ReadonlyArray<ComposerKeyAction>, boolean]
  const rows: Array<WinRow> = [
    ['ArrowUp, empty: edit the last message', win(), k('ArrowUp'), [editLast], true],
    ['ArrowUp, text: focus the composer', win({textEmpty: false}), k('ArrowUp'), [focusInput], false],
    ['ArrowUp, editing: focus the composer', win({editing: true}), k('ArrowUp'), [focusInput], false],
    ['Escape, editing: cancel the edit', win({editing: true}), k('Escape'), [cancelEdit], false],
    ['Escape, replying: cancel the reply', win({replying: true}), k('Escape'), [cancelReply], false],
    [
      'Escape, editing a reply: cancel the edit',
      win({editing: true, replying: true}),
      k('Escape'),
      [cancelEdit],
      false,
    ],
    ['Escape, neither: focus the composer', win(), k('Escape'), [focusInput], false],
    ['ctrl-U: file picker, no focus', win(), k('u', {ctrlKey: true}), [openFilePicker], false],
    ['cmd-U: file picker', win(), k('u', {metaKey: true}), [openFilePicker], false],
    ['PageUp: scroll up', win(), k('PageUp'), [scrollUp], false],
    ['PageDown: scroll down', win(), k('PageDown'), [scrollDown], false],
    ['Enter: focus, never send', win({textEmpty: false}), k('Enter'), [focusInput], false],
    ['Backspace: focus', win(), k('Backspace'), [focusInput], false],
    ['Delete: focus', win(), k('Delete'), [focusInput], false],
    ['ArrowLeft: focus', win(), k('ArrowLeft'), [focusInput], false],
    ['ArrowRight: focus', win(), k('ArrowRight'), [focusInput], false],
    ['ArrowDown: focus', win(), k('ArrowDown'), [focusInput], false],
    ['ctrl-V: focus', win(), k('v', {ctrlKey: true}), [focusInput], false],
    ['cmd-V: focus', win(), k('v', {metaKey: true}), [focusInput], false],
    ['keydown of a letter: nothing', win(), k('a'), [], false],
    ['keypress of a letter: focus', win({keypress: true}), k('a'), [focusInput], false],
    ['Tab: nothing', win(), k('Tab'), [], false],
    ['keypress of u with ctrl: file picker', win({keypress: true}), k('u', {ctrlKey: true}), [openFilePicker], false],
  ]

  test.each(rows)('%s', (_name, state, key, actions, preventDefault) => {
    expect(composerKeyDown(state, key)).toEqual({actions, preventDefault})
  })
})

describe('hardware keys', () => {
  test('enter sends', () => {
    expect(composerKeyDown({source: 'hardware'}, keyFromHardware('enter'))).toEqual({
      actions: [submit],
      preventDefault: false,
    })
  })

  test('shift-enter inserts a newline', () => {
    expect(composerKeyDown({source: 'hardware'}, keyFromHardware('shift-enter'))).toEqual({
      actions: [newline],
      preventDefault: false,
    })
  })

  test('the native key names map to key and shift', () => {
    expect(keyFromHardware('enter')).toEqual(k('Enter'))
    expect(keyFromHardware('shift-enter')).toEqual(k('Enter', {shiftKey: true}))
    expect(keyFromHardware('escape')).toEqual(k('escape'))
  })
})

// sweeps over every key and state combination that could matter, for the rules that hold
// across the board
const keys = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Tab',
  'Escape',
  'PageUp',
  'PageDown',
  'Backspace',
  'Delete',
  'u',
  'v',
  'a',
  'enter',
  'shift-enter',
]
const modifierSets: Array<Mods> = []
for (let bits = 0; bits < 16; bits++) {
  modifierSets.push({
    altKey: !!(bits & 1),
    ctrlKey: !!(bits & 2),
    metaKey: !!(bits & 4),
    shiftKey: !!(bits & 8),
  })
}
const bools = [false, true]
const threadFacts = bools.flatMap(editing =>
  bools.flatMap(replying => bools.map(textEmpty => ({editing, replying, textEmpty})))
)
const allKeys = keys.flatMap(key => modifierSets.map(mods => k(key, mods)))
const suggestionStates: Array<Suggestions> = ['none', 'empty', 'unfiltered', 'filtered']
const showsItems = (s: InputKeyState) => s.suggestions === 'unfiltered' || s.suggestions === 'filtered'
const listKeys = new Set(['ArrowUp', 'ArrowDown', 'Tab'])
const allInputStates = threadFacts.flatMap(f => suggestionStates.map(suggestions => input({...f, suggestions})))

describe('across every key and state', () => {
  test('a key typed into some other input is never handled', () => {
    for (const f of threadFacts) {
      for (const keypress of bools) {
        for (const key of allKeys) {
          expect(composerKeyDown(win({...f, keypress, targetIsInput: true}), key)).toEqual({
            actions: [],
            preventDefault: false,
          })
        }
      }
    }
  })

  test('a hardware key other than Enter does nothing, and Enter only reads shift', () => {
    for (const key of allKeys) {
      const {actions} = composerKeyDown({source: 'hardware'}, key)
      if (key.key !== 'Enter') {
        expect(actions).toEqual([])
      } else {
        expect(actions).toEqual([key.shiftKey ? newline : submit])
      }
    }
  })

  test('with no list, or one with no items yet, the textarea never touches suggestions', () => {
    for (const s of allInputStates.filter(s => !showsItems(s))) {
      for (const key of allKeys) {
        const {actions} = composerKeyDown(s, key)
        expect(actions.filter(a => a.type === 'suggestionMove' || a.type === 'suggestionSelect')).toEqual([])
      }
    }
  })

  test('with a list showing items Enter never sends outright; it picks first', () => {
    for (const s of allInputStates.filter(showsItems)) {
      for (const key of allKeys.filter(k => k.key === 'Enter')) {
        const {actions} = composerKeyDown(s, key)
        expect(actions.some(a => a.type === 'submit')).toBe(false)
      }
    }
  })

  // a list with no items yet still claims the keys that move through it, so a key pressed as it
  // loads never leaves the textarea or moves the caret
  test("the default is prevented exactly when the key sends, picks, moves, edits or is an open list's", () => {
    for (const s of allInputStates) {
      for (const key of allKeys) {
        const {actions, preventDefault} = composerKeyDown(s, key)
        const claims =
          (s.suggestions !== 'none' && listKeys.has(key.key)) ||
          actions.some(
            a =>
              a.type === 'submit' ||
              a.type === 'suggestionSelect' ||
              a.type === 'suggestionMove' ||
              a.type === 'editLast'
          )
        expect(preventDefault).toBe(claims)
      }
    }
  })

  test('an edit in progress wins Escape over a reply, in the textarea and the window', () => {
    for (const s of allInputStates.filter(s => s.editing)) {
      expect(composerKeyDown(s, k('Escape')).actions).toEqual([cancelEdit])
    }
    for (const f of threadFacts.filter(f => f.editing)) {
      expect(composerKeyDown(win(f), k('Escape')).actions).toEqual([cancelEdit])
    }
  })

  // the window's action type already rules out sends and suggestion actions
  test('a window key does at most one thing', () => {
    for (const f of threadFacts) {
      for (const keypress of bools) {
        for (const key of allKeys) {
          const {actions} = composerKeyDown(win({...f, keypress}), key)
          expect(actions.length).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
