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
const closeList = {type: 'closeSuggestions'} as const
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
    ['shift-ArrowUp, empty: nothing', input(), k('ArrowUp', {shiftKey: true}), [], false],
    ['cmd-ArrowUp, empty: nothing', input(), k('ArrowUp', {metaKey: true}), [], false],
    ['ArrowUp, text, list open: move up', input({...withText, suggestions: open}), k('ArrowUp'), [moveUp], true],
    ['ArrowUp, empty, list open: move up only', input({suggestions: open}), k('ArrowUp'), [moveUp], true],
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
    ['shift-Enter: newline by the browser', input(withText), k('Enter', {shiftKey: true}), [], false],
    ['alt-Enter: newline', input(withText), k('Enter', {altKey: true}), [newline], true],
    ['ctrl-Enter: newline', input(withText), k('Enter', {ctrlKey: true}), [newline], true],
    ['meta-Enter: newline', input(withText), k('Enter', {metaKey: true}), [newline], true],
    ['ctrl-shift-Enter: newline', input(withText), k('Enter', {ctrlKey: true, shiftKey: true}), [newline], true],
    ['shift-Enter, empty: newline by the browser', input(), k('Enter', {shiftKey: true}), [], false],
    ['alt-Enter, editing: newline', input({...withText, editing: true}), k('Enter', {altKey: true}), [newline], true],
    ['Enter, list open: pick, else send', input({suggestions: open}), k('Enter'), [pickOrSend], true],
    [
      'Enter, unfiltered list: pick, else send',
      input({suggestions: 'unfiltered'}),
      k('Enter'),
      [pickOrSend],
      true,
    ],
    [
      'shift-Enter, list open: newline by the browser, no pick',
      input({suggestions: open}),
      k('Enter', {shiftKey: true}),
      [],
      false,
    ],
    ['alt-Enter, list open: newline, no pick', input({suggestions: open}), k('Enter', {altKey: true}), [newline], true],
    ['ctrl-Enter, list open: newline, no pick', input({suggestions: open}), k('Enter', {ctrlKey: true}), [newline], true],
    ['meta-Enter, list open: newline, no pick', input({suggestions: open}), k('Enter', {metaKey: true}), [newline], true],
    [
      'alt-Enter, unfiltered list: newline, no pick',
      input({suggestions: 'unfiltered'}),
      k('Enter', {altKey: true}),
      [newline],
      true,
    ],
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
    ['Escape, editing: cancel the edit', input({editing: true}), k('Escape'), [cancelEdit], true],
    ['Escape, replying: cancel the reply', input({replying: true}), k('Escape'), [cancelReply], true],
    [
      'Escape, editing a reply: cancel the edit only',
      input({editing: true, replying: true}),
      k('Escape'),
      [cancelEdit],
      true,
    ],
    ['Escape, neither: nothing', input(withText), k('Escape'), [], false],
    // the edit or reply waits for the next Escape
    [
      'Escape, editing, list open: only the list closes',
      input({editing: true, suggestions: open}),
      k('Escape'),
      [closeList],
      true,
    ],
    [
      'Escape, replying, list open: only the list closes',
      input({replying: true, suggestions: open}),
      k('Escape'),
      [closeList],
      true,
    ],
    ['Escape, list open only: the list closes', input({suggestions: open}), k('Escape'), [closeList], true],
    [
      'Escape, editing, list open with no items yet: cancel the edit',
      input({editing: true, suggestions: 'empty'}),
      k('Escape'),
      [cancelEdit],
      true,
    ],
    ['Escape, list open with no items yet only: nothing', input({suggestions: 'empty'}), k('Escape'), [], false],
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
    ['alt-ArrowUp, empty: focus the composer', win(), k('ArrowUp', {altKey: true}), [focusInput], false],
    ['Escape, editing: cancel the edit', win({editing: true}), k('Escape'), [cancelEdit], true],
    ['Escape, replying: cancel the reply', win({replying: true}), k('Escape'), [cancelReply], true],
    [
      'Escape, editing a reply: cancel the edit',
      win({editing: true, replying: true}),
      k('Escape'),
      [cancelEdit],
      true,
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
  const hw = (suggestions: Suggestions = 'none') => ({source: 'hardware', suggestions}) as const

  test('enter sends', () => {
    expect(composerKeyDown(hw(), keyFromHardware('enter'))).toEqual({
      actions: [submit],
      preventDefault: false,
    })
  })

  test('shift-enter inserts a newline', () => {
    expect(composerKeyDown(hw(), keyFromHardware('shift-enter'))).toEqual({
      actions: [newline],
      preventDefault: false,
    })
  })

  test('enter with a list open that has no items yet sends', () => {
    expect(composerKeyDown(hw('empty'), keyFromHardware('enter'))).toEqual({
      actions: [submit],
      preventDefault: false,
    })
  })

  test.each(['unfiltered', 'filtered'] as const)('enter with a %s list open picks, else sends', suggestions => {
    expect(composerKeyDown(hw(suggestions), keyFromHardware('enter'))).toEqual({
      actions: [pickOrSend],
      preventDefault: false,
    })
  })

  test('shift-enter with a list open still inserts a newline', () => {
    expect(composerKeyDown(hw('filtered'), keyFromHardware('shift-enter')).actions).toEqual([newline])
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

  test('a hardware key other than Enter does nothing, and Enter reads only shift and the list', () => {
    for (const suggestions of suggestionStates) {
      for (const key of allKeys) {
        const {actions} = composerKeyDown({source: 'hardware', suggestions}, key)
        if (key.key !== 'Enter') {
          expect(actions).toEqual([])
        } else if (key.shiftKey) {
          expect(actions).toEqual([newline])
        } else {
          expect(actions).toEqual([suggestions === 'none' || suggestions === 'empty' ? submit : pickOrSend])
        }
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

  test('only a plain ArrowUp edits the last message, in the textarea and the window', () => {
    const plain = (key: ComposerKey) =>
      key.key === 'ArrowUp' && !(key.altKey || key.ctrlKey || key.metaKey || key.shiftKey)
    for (const s of allInputStates) {
      for (const key of allKeys.filter(k => !plain(k))) {
        expect(composerKeyDown(s, key).actions).not.toContainEqual(editLast)
      }
    }
    for (const f of threadFacts) {
      for (const key of allKeys.filter(k => !plain(k))) {
        expect(composerKeyDown(win(f), key).actions).not.toContainEqual(editLast)
      }
    }
  })

  test('with a list showing items ArrowUp only moves the highlight, and with one still empty it does nothing', () => {
    for (const s of allInputStates.filter(s => s.suggestions !== 'none')) {
      for (const key of allKeys.filter(k => k.key === 'ArrowUp')) {
        expect(composerKeyDown(s, key).actions).toEqual(showsItems(s) ? [moveUp] : [])
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

  test('an Enter with alt, ctrl or meta held only inserts a newline, and claims the key', () => {
    for (const s of allInputStates) {
      for (const key of allKeys.filter(k => k.key === 'Enter' && (k.altKey || k.ctrlKey || k.metaKey))) {
        expect(composerKeyDown(s, key)).toEqual({actions: [newline], preventDefault: true})
      }
    }
  })

  test('a shift-Enter is left to the browser', () => {
    for (const s of allInputStates) {
      expect(composerKeyDown(s, k('Enter', {shiftKey: true}))).toEqual({actions: [], preventDefault: false})
    }
  })

  test('a plain Enter never inserts a newline in the textarea', () => {
    for (const s of allInputStates) {
      expect(composerKeyDown(s, k('Enter')).actions).not.toContainEqual(newline)
    }
  })

  // a list with no items yet still claims the keys that move through it, so a key pressed as it
  // loads never leaves the textarea or moves the caret
  test("the default is prevented exactly when the key sends, picks, moves, edits, cancels, inserts a newline, closes the list or is an open list's", () => {
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
              a.type === 'editLast' ||
              a.type === 'cancelEdit' ||
              a.type === 'cancelReply' ||
              a.type === 'newline' ||
              a.type === 'closeSuggestions'
          )
        expect(preventDefault).toBe(claims)
      }
    }
  })

  test('Escape with a list showing items in the textarea only closes the list, whatever else is going on', () => {
    for (const s of allInputStates.filter(showsItems)) {
      expect(composerKeyDown(s, k('Escape'))).toEqual({actions: [closeList], preventDefault: true})
    }
  })

  test('a window Escape prevents the default exactly when it cancels something', () => {
    for (const f of threadFacts) {
      const {preventDefault} = composerKeyDown(win(f), k('Escape'))
      expect(preventDefault).toBe(f.editing || f.replying)
    }
  })

  test('an edit in progress wins Escape over a reply, in the textarea and the window', () => {
    for (const s of allInputStates.filter(s => s.editing && !showsItems(s))) {
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
