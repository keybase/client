/** @jest-environment jsdom */
/// <reference types="jest" />
// The components here render on both platforms' copies of React; the compiler's runtime import
// would tie them to one
'use no memo'
import type * as React from 'react'
import type * as RTL from '@testing-library/react'
import type * as ComposerModule from './composer'
import type * as InputModule from './normal/input'
import type * as LoggerModule from '@/logger'
import type {SuppressSnapshot} from '../unfurl-preview-state'

// input.tsx pulls in the native-only halves of the input bar at module scope; the low-level input
// under test uses none of them
jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))

// The composer runs against both real platform inputs: the desktop textarea and the native
// TextInput (react-native-web's, which jest maps react-native to). input.tsx picks its half from
// the platform globals as it loads, so each platform gets its own module registry, React and
// testing-library included, loaded with its globals set; the same globals are set while its tests
// run, since the styles read them as they render.
type Globals = {isElectron: boolean; isMobile: boolean}
type Kit = {
  Composer: typeof ComposerModule
  Input: typeof InputModule.Input
  RTL: typeof RTL
  React: typeof React
  globals: Globals
  logger: typeof LoggerModule.default
  name: 'desktop' | 'native'
}
const g = globalThis as unknown as Globals
const setGlobals = (next: Globals) => {
  g.isElectron = next.isElectron
  g.isMobile = next.isMobile
}
const load = (name: Kit['name'], globals: Globals): Kit => {
  const before = {isElectron: g.isElectron, isMobile: g.isMobile}
  let kit: Kit | undefined
  jest.isolateModules(() => {
    setGlobals(globals)
     
    kit = {
      Composer: require('./composer') as typeof ComposerModule,
      Input: (require('./normal/input') as typeof InputModule).Input,
      RTL: require('@testing-library/react') as typeof RTL,
      React: require('react') as typeof React,
      globals,
      logger: (require('@/logger') as typeof LoggerModule).default,
      name,
    }
     
  })
  setGlobals(before)
  return kit!
}
const desktop = load('desktop', {isElectron: true, isMobile: false})
const native = load('native', {isElectron: false, isMobile: true})

const noSnapshot: SuppressSnapshot = {dismissed: [], failed: []}

// Runs every call in act, as the input's own state updates follow from the composer's writes.
const inAct = <O extends object>(kit: Kit, o: O): O =>
  new Proxy(o, {
    get: (target, key) => {
      const v: unknown = Reflect.get(target, key)
      if (typeof v !== 'function') return v
      return (...args: Array<unknown>) => {
        let result: unknown
        kit.RTL.act(() => {
          result = (v as (...a: Array<unknown>) => unknown).apply(target, args)
        })
        return result
      }
    },
  })

// What a user does to a real platform input's element, and what it shows.
const drive = (kit: Kit, el: HTMLTextAreaElement) => {
  const {act, fireEvent} = kit.RTL
  return {
    el,
    // the user tapping or clicking into it
    focus: () => {
      act(() => {
        el.focus()
      })
    },
    // the caret the element shows
    get selection() {
      return {end: el.selectionEnd, start: el.selectionStart}
    },
    // the user selecting a range: the element reports it as a select event, which React only
    // passes on for the focused element (fireEvent.select focuses it first, as a click would)
    select: (start: number, end: number) => {
      act(() => {
        el.setSelectionRange(start, end)
        fireEvent.select(el)
      })
    },
    get text() {
      return el.value
    },
    // a keystroke or paste into the focused input: the new text, then the caret moving, each
    // reported as the element does
    type: (text: string, caret = text.length) => {
      act(() => {
        fireEvent.change(el, {target: {value: text}})
        el.setSelectionRange(caret, caret)
        fireEvent.select(el)
      })
    },
    // the new text with no caret reported after it, and no focus
    typeWithoutCaret: (text: string) => {
      act(() => {
        fireEvent.change(el, {target: {value: text}})
      })
    },
  }
}

// One real platform input, rendered on its own. Its reports go to onReport.
const renderField = (kit: Kit, onReport: (text: string) => void) => {
  let handle: InputModule.RefType | null = null
  const {container} = kit.RTL.render(
    <kit.Input
      multiline={true}
      onChangeText={onReport}
      ref={h => {
        handle = h
      }}
    />
  )
  const real = handle!
  // the composer's own focus calls, as opposed to the user focusing the element
  const focus = jest.spyOn(real, 'focus')
  const field = drive(kit, container.querySelector('textarea')!) as ReturnType<typeof drive> & {
    readonly focusCount: number
    readonly handle: InputModule.RefType
  }
  Object.defineProperties(field, {
    focusCount: {get: () => focus.mock.calls.length},
    handle: {value: real},
  })
  return field
}
type Field = ReturnType<typeof renderField>

// jsdom has no document.execCommand, so in jest the desktop input can never type an insert itself
// and the composer always splices it in instead. Chromium's insertText, which the desktop input
// uses, puts the text in at the focused element's selection and fires the input event; this gives
// jsdom that, for the tests of an input that types.
const installInsertText = () => {
  const doc = document as unknown as {execCommand?: (c: string, ui: boolean, v: string) => boolean}
  doc.execCommand = (command, _ui, value) => {
    const el = document.activeElement
    if (command !== 'insertText' || !(el instanceof HTMLTextAreaElement)) return false
    el.setRangeText(value, el.selectionStart, el.selectionEnd, 'end')
    el.dispatchEvent(new InputEvent('input', {bubbles: true, data: value, inputType: 'insertText'}))
    return true
  }
}

afterEach(() => {
  delete (document as {execCommand?: unknown}).execCommand
  jest.useRealTimers()
  jest.restoreAllMocks()
})

const makeSetup = (kit: Kit, opts?: {takeUnfurlSnapshot?: () => SuppressSnapshot}) => {
  const send = jest.fn()
  // what the composer saves as the draft ('flush' where it asks for a pending save to go now),
  // and every report the attached input makes, with whether the composer took it as typing
  const drafts: Array<string> = []
  const reports: Array<{text: string; typed: boolean}> = []
  // the draft the store holds, which an input reads as it attaches
  let stored: string | undefined
  const store = (draft: string | undefined) => {
    stored = draft
  }
  // stands in for the conversation's cannotWrite in the inbox metadata store
  let readOnly = false
  const raw = kit.Composer.makeComposer({
      flushDraft: () => {
        drafts.push('flush')
      },
      getDraft: () => stored,
      isReadOnly: () => readOnly,
      // as the provider's save writes the draft into the conversation's meta, once there is one
      saveDraft: text => {
        drafts.push(text)
        if (stored !== undefined) {
          stored = text
        }
      },
      takeUnfurlSnapshot: opts?.takeUnfurlSnapshot ?? (() => noSnapshot),
    })
  // the composer as a test calls it, each call in act; the tree under test gets the composer itself
  const composer = inAct(kit, raw)
  // one composer view, with the store holding draft as it attaches its input: the input's reports
  // go to the composer, as useComposerInput wires them
  const mount = (draft?: string) => {
    store(draft)
    const viewItself = raw.connect()
    const view = inAct(kit, viewItself)
    const report = (text: string) => {
      reports.push({text, typed: viewItself.textChanged(text)})
    }
    const field = renderField(kit, report)
    const attach = (input: Field = field) => {
      view.setInput(input.handle)
    }
    attach()
    // another input reporting to this view, as a remounted element does
    const another = () => renderField(kit, report)
    return {another, attach, detach: () => view.setInput(null), field, view}
  }
  const setReadOnly = (next: boolean) => {
    readOnly = next
  }
  // a view mounting on whatever draft the store holds now
  const mountOnStore = () => mount(stored)
  return {composer, drafts, mount, mountOnStore, raw, reports, send, setReadOnly, store}
}

// A composer view as the platform input bar mounts one: the input's ref attaches it, and its
// reports go to the composer. A new inputKey mounts a new element, which hands the view a new handle.
const makeInputView = (kit: Kit) =>
  function InputView(p: {children?: React.ReactNode; draft?: string; inputKey?: string; readOnly?: boolean}) {
    const {children, draft, inputKey, readOnly = false} = p
    const {setInput, textChanged} = kit.Composer.useComposerInput(draft, readOnly)
    return (
      <>
        <kit.Input key={inputKey} multiline={true} onChangeText={textChanged} ref={setInput} />
        {children}
      </>
    )
  }

describe.each([desktop, native])('on the $name input', kit => {
  const {ComposerContext, useComposerInput} = kit.Composer
  const {act, render, renderHook} = kit.RTL
  const logger = kit.logger
  const InputView = makeInputView(kit)
  const {Activity, useEffect, useLayoutEffect} = kit.React
  const setup = (opts?: Parameters<typeof makeSetup>[1]) => makeSetup(kit, opts)
  beforeAll(() => {
    setGlobals(kit.globals)
  })
  afterAll(() => {
    setGlobals(desktop.globals)
  })

  describe('text', () => {
    test('starts empty and follows what the input reports', () => {
      const {composer, mount} = setup()
      expect(composer.getText()).toBe('')
      const {field} = mount()

      field.type('hello')

      expect(composer.getText()).toBe('hello')
    })

    test('a report from an input that is no longer attached is ignored', () => {
      const {composer, mount} = setup()
      const first = mount()
      first.detach()
      mount()

      first.field.type('late echo from the old input')

      expect(composer.getText()).toBe('')
    })

    test('stays readable after the input detaches', () => {
      const {composer, mount} = setup()
      const {detach, field} = mount()
      field.type('still here')

      detach()

      expect(composer.getText()).toBe('still here')
    })
  })

  describe('inject', () => {
    test('replaces the whole text with the caret at the end and echoes it', () => {
      const {composer, mount} = setup()
      const {field} = mount()
      field.type('old')

      composer.inject('new text')

      expect(field.text).toBe('new text')
      expect(field.selection).toEqual({end: 8, start: 8})
      expect(composer.getText()).toBe('new text')
      expect(field.focusCount).toBe(0)
    })

    test('focuses only when asked', () => {
      const {composer, mount} = setup()
      const {field} = mount()

      composer.inject('a', true)
      composer.inject('b')

      expect(field.focusCount).toBe(1)
    })

    test('selects the placeholder inside the spoiler markup', () => {
      const {composer, mount} = setup()
      const {field} = mount()

      composer.inject('!>spoiler<!')

      expect(field.selection).toEqual({end: 9, start: 2})
    })

    test('an empty text goes through clear', () => {
      const {composer, mount} = setup()
      const {field} = mount()
      field.type('something')
      const replaceText = jest.spyOn(field.handle, 'replaceText')
      const clear = jest.spyOn(field.handle, 'clear')

      composer.inject('')

      expect(clear).toHaveBeenCalledTimes(1)
      expect(replaceText).not.toHaveBeenCalled()
      expect(composer.getText()).toBe('')
    })

    test('waits while no input is attached and the last text lands on attach, with the focus asked for', () => {
      const {composer, mount} = setup()

      composer.inject('first', true)
      composer.inject('second')
      expect(composer.getText()).toBe('')
      const {field} = mount()

      expect(field.text).toBe('second')
      expect(field.focusCount).toBe(1)
      expect(composer.getText()).toBe('second')
    })

    test('a waiting text and its focus land once', () => {
      const {composer, mount} = setup()
      composer.inject('once', true)
      const first = mount()
      first.detach()

      const second = mount()

      expect(first.field.focusCount).toBe(1)
      expect(second.field.text).toBe('')
      expect(second.field.focusCount).toBe(0)
    })

    test('a waiting inject without focus does not focus on attach', () => {
      const {composer, mount} = setup()
      composer.inject('quiet')

      const {field} = mount()

      expect(field.text).toBe('quiet')
      expect(field.focusCount).toBe(0)
    })

    test('an input whose ref is emptied is detached: the text waits for it and lands when it is set again', () => {
      const {composer, mount} = setup()
      const {attach, detach, field} = mount()
      field.type('kept')
      detach()

      composer.inject('not lost')
      expect(field.text).toBe('kept')
      attach()

      expect(field.text).toBe('not lost')
      expect(composer.getText()).toBe('not lost')
    })
  })

  describe('append', () => {
    test('puts the text on its own line after a loaded draft, and saves both', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount('my draft')

      composer.append('shared text')

      expect(field.text).toBe('my draft\nshared text')
      expect(field.selection).toEqual({end: 20, start: 20})
      expect(drafts).toEqual(['my draft\nshared text'])
    })

    test('adds no blank line after a draft ending in a newline', () => {
      const {composer, mount} = setup()
      const {field} = mount('my draft\n')

      composer.append('shared text')

      expect(field.text).toBe('my draft\nshared text')
    })

    test('is the whole text when there is no draft', () => {
      const {composer, mount} = setup()
      const {field} = mount('')

      composer.append('shared text')

      expect(field.text).toBe('shared text')
    })

    test('goes after a draft the store has before the view offers it', () => {
      const {composer, mount, store} = setup()
      const {field} = mount(undefined)
      store('my draft')

      composer.append('shared text')

      expect(field.text).toBe('my draft\nshared text')
    })

    test('with no input attached, is saved after the draft, and shows once an input loads it', () => {
      const {composer, drafts, mountOnStore, store} = setup()
      store('my draft')

      composer.append('shared text')
      expect(drafts).toEqual(['my draft\nshared text', 'flush'])

      const {field} = mountOnStore()
      expect(field.text).toBe('my draft\nshared text')
    })

    test('with no input and no draft known, is saved at once as the whole draft, and an input then shows it', () => {
      const {composer, drafts, mount} = setup()
      composer.append('shared text')
      expect(drafts).toEqual(['shared text', 'flush'])

      // the provider's save puts it in the store
      const {field} = mount('shared text')

      expect(field.text).toBe('shared text')
    })

    test('with its input detached, is saved after the draft, and shows when that input attaches again', () => {
      const {composer, drafts, mount} = setup()
      const {attach, detach, field} = mount('my draft')
      detach()

      composer.append('shared text')
      expect(drafts).toContain('my draft\nshared text')

      attach()
      expect(field.text).toBe('my draft\nshared text')
    })

    test('two appends land in order, each on its own line', () => {
      const {composer, mount} = setup()
      const {field} = mount('my draft')
      composer.append('one')
      composer.append('two')

      expect(field.text).toBe('my draft\none\ntwo')
    })

    test('during an edit, is saved after the draft the edit set aside, never into the edit', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount('my draft')
      composer.startEdit('my message')

      composer.append('shared text')

      expect(field.text).toBe('my message')
      expect(drafts).toEqual(['my draft\nshared text', 'flush'])
      composer.clear()
      expect(field.text).toBe('my draft\nshared text')
    })

    test('during an edit started before the draft loaded, is saved after the store\'s draft', () => {
      const {composer, drafts, mount, store} = setup()
      const {field} = mount(undefined)
      composer.startEdit('my message')
      store('my draft')

      composer.append('shared text')

      expect(field.text).toBe('my message')
      expect(drafts).toEqual(['my draft\nshared text', 'flush'])
      composer.clear()
      expect(field.text).toBe('my draft\nshared text')
    })

    test('where the user cannot post, is saved after the draft, and shows once they can', () => {
      const {composer, drafts, mount, setReadOnly} = setup()
      const {field, view} = mount('my draft')
      setReadOnly(true)

      composer.append('shared text')
      expect(field.text).toBe('my draft')
      expect(drafts).toEqual(['my draft\nshared text', 'flush'])

      setReadOnly(false)
      view.offerDraft('my draft\nshared text')
      expect(field.text).toBe('my draft\nshared text')
    })

    test('with no draft known (its load failed), goes in as the whole text, as an inject does', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount(undefined)

      composer.append('shared text')

      expect(field.text).toBe('shared text')
      expect(drafts).toEqual(['shared text'])
    })

    test('with no draft known, during an edit, is saved as the whole draft and the edit is left alone', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount(undefined)
      composer.startEdit('my message')

      composer.append('shared text')

      expect(field.text).toBe('my message')
      expect(drafts).toEqual(['shared text', 'flush'])
      composer.clear()
      expect(field.text).toBe('shared text')
    })

    test('saved during an edit, comes back as the edit ends, and once sent is not loaded again', () => {
      const {composer, mount} = setup()
      const {field, view} = mount(undefined)
      composer.startEdit('my message')
      composer.append('shared text')
      composer.clear()
      expect(field.text).toBe('shared text')

      composer.submit(jest.fn())
      // the store offering the draft as the append saved it
      view.offerDraft('shared text')

      expect(field.text).toBe('')
    })

    test('with no draft known, where the user cannot post, is saved as the whole draft', () => {
      const {composer, drafts, mount, setReadOnly} = setup()
      const {field} = mount(undefined)
      setReadOnly(true)

      composer.append('shared text')

      expect(field.text).toBe('')
      expect(drafts).toEqual(['shared text', 'flush'])
    })

    test('with no input attached, is saved before anything else happens: nothing waits on an input', () => {
      const {composer, drafts, mount} = setup()
      const {detach} = mount(undefined)
      detach()

      composer.append('shared text')

      expect(drafts).toContain('shared text')
    })
  })

  describe('draft', () => {
    test('loads into an untouched composer on attach', () => {
      const {composer, mount} = setup()

      const {field} = mount('saved')

      expect(field.text).toBe('saved')
      expect(field.selection).toEqual({end: 5, start: 5})
      expect(composer.getText()).toBe('saved')
    })

    test('loads once, when it first arrives', () => {
      const {mount} = setup()
      const {field, view} = mount(undefined)

      view.offerDraft('arrived')
      view.offerDraft('arrived again, changed')

      expect(field.text).toBe('arrived')
    })

    test('does not overwrite text already typed', () => {
      const {mount} = setup()
      const {field, view} = mount(undefined)
      field.type('typed')

      view.offerDraft('stale')

      expect(field.text).toBe('typed')
    })

    test('an empty draft counts as loaded', () => {
      const {mount} = setup()
      const {field, view} = mount('')

      view.offerDraft('later')

      expect(field.text).toBe('')
    })

    test('waits while the input has no handle, and loads once it has one', () => {
      const {composer, mount, store} = setup()
      const {detach, field, view} = mount(undefined)
      detach()

      store('saved')
      view.offerDraft('saved')
      expect(field.text).toBe('')
      view.setInput(field.handle)

      expect(field.text).toBe('saved')
      expect(composer.getText()).toBe('saved')
    })

    // a new ref callback on a render makes React clear the old one and set the new one
    test('the ref setter stays the same across renders, whatever the draft', () => {
      const {raw} = setup()
      const wrapper = (p: {children: React.ReactNode}) => (
        <ComposerContext value={raw}>{p.children}</ComposerContext>
      )
      const {rerender, result} = renderHook((p: {draft?: string}) => useComposerInput(p.draft, false), {
        initialProps: {draft: undefined as string | undefined},
        wrapper,
      })
      const {setInput, textChanged} = result.current

      rerender({draft: 'saved'})
      rerender({draft: 'saved'})

      expect(result.current.setInput).toBe(setInput)
      expect(result.current.textChanged).toBe(textChanged)
    })

    test('a mounted input whose handle is set late gets the draft when it is set', () => {
      const {composer, raw, store} = setup()
      store('saved')
      const wrapper = (p: {children: React.ReactNode}) => (
        <ComposerContext value={raw}>{p.children}</ComposerContext>
      )
      const {result} = renderHook(() => useComposerInput('saved', false), {wrapper})
      expect(composer.getText()).toBe('')
      const field = renderField(kit, t => result.current.textChanged(t))

      act(() => {
        result.current.setInput(field.handle)
      })

      expect(field.text).toBe('saved')
      expect(composer.getText()).toBe('saved')
    })

    // The input is a child of the view, as the platform inputs are, so it attaches before any of the
    // view's own layout effects run.
    test('an input attaching in the commit that changes the draft loads that commit\'s draft', () => {
      const {composer, raw, store} = setup()
      const View = (p: {draft?: string; shown: boolean}) => {
        const {draft, shown} = p
        const {setInput, textChanged} = useComposerInput(draft, false)
        return shown ? <kit.Input multiline={true} onChangeText={textChanged} ref={setInput} /> : null
      }
      const tree = (draft: string | undefined, shown: boolean) => (
        <ComposerContext value={raw}>
          <View draft={draft} shown={shown} />
        </ComposerContext>
      )
      store('stale')
      const {container, rerender} = render(tree('stale', false))

      store('current')
      rerender(tree('current', true))

      expect(container.querySelector('textarea')!.value).toBe('current')
      expect(composer.getText()).toBe('current')
    })

    // the view renders the draft a render behind the store; the input reads the store as it attaches
    test('an input attaching loads the draft the store holds then, not the one the view rendered', () => {
      const {composer, raw, store} = setup()
      const wrapper = (p: {children: React.ReactNode}) => (
        <ComposerContext value={raw}>{p.children}</ComposerContext>
      )
      store('stale')
      const {result} = renderHook(() => useComposerInput('stale', false), {wrapper})
      store('current')
      const field = renderField(kit, t => result.current.textChanged(t))

      act(() => {
        result.current.setInput(field.handle)
      })

      expect(field.text).toBe('current')
      expect(composer.getText()).toBe('current')
    })

    test('an offer from an input that is not attached is ignored', () => {
      const {composer, mount} = setup()
      const first = mount(undefined)

      composer.connect().offerDraft('saved')

      expect(first.field.text).toBe('')
      first.view.offerDraft('saved')
      expect(first.field.text).toBe('saved')
    })

    test('a waiting inject is applied after the draft, so it wins', () => {
      const {composer, mount} = setup()
      composer.inject('intent')

      const {field} = mount('saved')

      expect(field.text).toBe('intent')
    })

    test('a waiting empty inject clears the draft it follows', () => {
      const {composer, mount} = setup()
      composer.inject('')

      const {field} = mount('saved')

      expect(field.text).toBe('')
      expect(composer.getText()).toBe('')
    })

    test('re-attaching the same input keeps its text and does not reload the draft', () => {
      const {composer, mount} = setup()
      const {attach, detach, field} = mount('saved')
      field.type('edited')
      detach()

      attach()

      expect(field.text).toBe('edited')
      expect(composer.getText()).toBe('edited')
    })

    test('a different input starts over: no text, and its draft loads', () => {
      const {composer, mount} = setup()
      const first = mount('saved')
      first.field.type('edited')
      first.detach()

      const second = mount('saved on unmount')

      expect(second.field.text).toBe('saved on unmount')
      expect(composer.getText()).toBe('saved on unmount')
    })
  })

  describe('insertAtCaret', () => {
    test('splices at the caret and parks the caret after the insert', () => {
      const {composer, mount} = setup()
      const {field} = mount()
      field.type('abcd', 2)

      composer.insertAtCaret('@')

      expect(field.text).toBe('ab@cd')
      expect(field.selection).toEqual({end: 3, start: 3})
      expect(composer.getText()).toBe('ab@cd')
    })

    test('replaces a selected range', () => {
      const {composer, mount} = setup()
      const {field} = mount()
      field.type('abcd')
      field.select(1, 3)

      composer.insertAtCaret('\n')

      expect(field.text).toBe('a\nd')
      expect(field.selection).toEqual({end: 2, start: 2})
    })

    test('the insert is reported like typing', () => {
      const {composer, mount, reports} = setup()
      mount()

      composer.insertAtCaret('x')

      expect(reports).toEqual([{text: 'x', typed: true}])
    })

    // effects mount children first, so a child's insert can come before its input attaches
    test('waits while no input is attached and lands at the caret once it attaches again', () => {
      const {composer, mount} = setup()
      const {attach, detach, field} = mount()
      field.type('abcd', 2)
      detach()

      composer.insertAtCaret('x')
      expect(field.text).toBe('abcd')
      attach()

      expect(field.text).toBe('abxcd')
      expect(composer.getText()).toBe('abxcd')
    })

    test('waiting writes land in the order they were made, once', () => {
      const {composer, mount} = setup()
      const {attach, detach} = mount()
      detach()

      composer.inject('hello')
      composer.insertAtCaret('!')
      composer.replace({selection: {end: 7, start: 7}, text: 'hello! '}, true)
      composer.insertAtCaret('x')
      attach()

      expect(composer.getText()).toBe('hello! x')
      detach()
      attach()
      expect(composer.getText()).toBe('hello! x')
    })
  })

  // Hiding an Activity clears the input's ref as the commit is made; its passive effects go later,
  // and a timer (the native 60ms send) can land in between. The composer is detached from the
  // moment the ref is cleared, so a clear made in that window (here, inside the commit) waits for
  // the input to be shown again instead of being lost.
  test('a send made in the commit that hides the input clears it once it is shown again', () => {
    jest.useFakeTimers()
    const {composer, raw, send} = setup()
    const SendInCommit = (p: {hidden: boolean}) => {
      const {hidden} = p
      useLayoutEffect(() => {
        if (hidden) raw.submit(send)
      }, [hidden])
      return null
    }
    const tree = (mode: 'hidden' | 'visible') => (
      <ComposerContext value={raw}>
        <Activity mode={mode}>
          <InputView />
        </Activity>
        <SendInCommit hidden={mode === 'hidden'} />
      </ComposerContext>
    )
    const {container, rerender} = render(tree('visible'))
    const field = drive(kit, container.querySelector('textarea')!)
    field.type('hello')

    rerender(tree('hidden'))
    jest.advanceTimersByTime(0)
    expect(send).toHaveBeenCalledWith('hello', noSnapshot)
    expect(field.text).toBe('hello')
    rerender(tree('visible'))

    expect(field.text).toBe('')
    expect(composer.getText()).toBe('')
  })

  // A hidden Activity (a screen kept but not shown) unmounts every effect, and showing it again
  // mounts them children first, so a child writes before its composer view attaches the input.
  test('an insert a child makes as its hidden screen is shown lands once the input attaches', () => {
    const {composer, raw} = setup()
    const Inserter = (p: {pick: string}) => {
      const {pick} = p
      useEffect(() => {
        if (pick) raw.insertAtCaret(pick)
      }, [pick])
      return null
    }
    const tree = (mode: 'hidden' | 'visible', pick: string) => (
      <ComposerContext value={raw}>
        <Activity mode={mode}>
          <InputView>
            <Inserter pick={pick} />
          </InputView>
        </Activity>
      </ComposerContext>
    )
    const {container, rerender} = render(tree('visible', ''))
    const field = drive(kit, container.querySelector('textarea')!)
    field.type('abcd', 2)
    rerender(tree('hidden', ''))
    rerender(tree('hidden', ':smile: '))
    expect(field.text).toBe('abcd')

    rerender(tree('visible', ':smile: '))

    expect(field.text).toBe('ab:smile: cd')
    expect(composer.getText()).toBe('ab:smile: cd')
  })

  describe('typeAtCaret', () => {
    test('an input that cannot type it gets it inserted at the caret', () => {
      const {composer, mount} = setup()
      const {field} = mount()
      field.type('abcd', 2)

      composer.typeAtCaret('\n')

      expect(field.text).toBe('ab\ncd')
      expect(field.selection).toEqual({end: 3, start: 3})
      expect(composer.getText()).toBe('ab\ncd')
    })

    test('waits while no input is attached and lands once it attaches again', () => {
      const {composer, mount} = setup()
      const {attach, detach, field} = mount()
      field.type('abc')
      detach()

      composer.typeAtCaret('\n')
      expect(composer.getText()).toBe('abc')
      attach()

      expect(composer.getText()).toBe('abc\n')
    })
  })

  describe('replace', () => {
    // the text it carries was worked out from the text the old view had
    test('a replace waiting from one view is dropped when another view attaches, so its draft stands', () => {
      const {composer, mount} = setup()
      const first = mount()
      first.field.type('hi @te')
      first.detach()

      composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, true)
      const second = mount('saved')

      expect(second.field.text).toBe('saved')
      expect(composer.getText()).toBe('saved')
    })

    test('a replace waiting from a view lands when that view attaches again', () => {
      const {composer, mount} = setup()
      const {attach, detach, field} = mount()
      field.type('hi @te')
      detach()

      composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, true)
      attach()

      expect(field.text).toBe('hi @testuser')
      expect(composer.getText()).toBe('hi @testuser')
    })
  })

  describe('submit', () => {
    test('saves an empty draft now, with no input attached as with one', () => {
      const {composer, drafts, mount, send} = setup()
      const {detach, field} = mount()
      field.type('hello')
      detach()

      composer.submit(send)

      expect(drafts).toEqual(['hello', 'flush', '', 'flush'])
    })

    test('with nothing typed sends nothing and leaves the input alone', () => {
      jest.useFakeTimers()
      const {composer, mount, send} = setup()
      const {field} = mount()

      expect(composer.submit(send)).toBe(false)
      jest.runAllTimers()

      expect(send).not.toHaveBeenCalled()
      expect(field.focusCount).toBe(0)
    })

    test('snapshots the unfurl dismissals, then clears and focuses, then sends on the next tick', () => {
      jest.useFakeTimers()
      const order: Array<string> = []
      const snapshot: SuppressSnapshot = {dismissed: ['http://a.com'], failed: []}
      const {composer, mount, send} = setup({
        takeUnfurlSnapshot: () => {
          order.push('snapshot')
          return snapshot
        },
      })
      const {field} = mount()
      field.type('look at http://a.com')
      const clear = field.handle.clear
      jest.spyOn(field.handle, 'clear').mockImplementation(() => {
        order.push('clear')
        clear()
      })
      expect(composer.submit(send)).toBe(true)

      expect(order).toEqual(['snapshot', 'clear'])
      expect(field.text).toBe('')
      expect(field.focusCount).toBe(1)
      expect(composer.getText()).toBe('')
      expect(send).not.toHaveBeenCalled()

      jest.advanceTimersByTime(0)

      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith('look at http://a.com', snapshot)
    })

    test('sends the text as it was when submitted, whatever is typed before the send runs', () => {
      jest.useFakeTimers()
      const {composer, mount, send} = setup()
      const {field} = mount()
      field.type('first')

      composer.submit(send)
      field.type('second')
      jest.advanceTimersByTime(0)

      expect(send).toHaveBeenCalledWith('first', noSnapshot)
    })

    // the draft the next input loads is the one saved as the old input unmounted, the text just
    // sent; the clear waiting for that input is newer, so it wins
    test('after the input detaches still sends, without an error, and the next input starts empty', () => {
      jest.useFakeTimers()
      const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
      const {composer, mount, send} = setup()
      const {detach, field} = mount()
      field.type('queued before unmount')
      detach()

      expect(composer.submit(send)).toBe(true)
      expect(composer.getText()).toBe('')
      jest.advanceTimersByTime(0)

      expect(error).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith('queued before unmount', noSnapshot)
      expect(composer.getText()).toBe('')
      const next = mount('queued before unmount')

      expect(next.field.text).toBe('')
      expect(composer.getText()).toBe('')
    })
  })

  describe('the input it reads through', () => {
    test('selection, focus and focusing go to the attached input', () => {
      const {composer, mount} = setup()
      const {field} = mount()
      field.type('abc', 1)

      composer.focus()

      expect(composer.getSelection()).toEqual({end: 1, start: 1})
      expect(composer.isFocused()).toBe(true)
      expect(field.focusCount).toBe(1)
    })

    test('with nothing attached there is no selection, and a focus waits for the next input', () => {
      const {composer, mount} = setup()
      const {another, attach, detach, field} = mount()
      // typed into, so focused
      field.type('abc')
      detach()

      composer.focus()

      expect(composer.getSelection()).toBeUndefined()
      expect(composer.isFocused()).toBe(false)
      expect(field.focusCount).toBe(0)
      const next = another()
      attach(next)
      expect(next.focusCount).toBe(1)
    })

    test('focus asked for again and again while nothing is attached focuses the next input once', () => {
      const {composer, mount} = setup()
      const {another, attach, detach} = mount()
      detach()

      composer.focus()
      composer.focus()
      composer.focus()

      const next = another()
      attach(next)
      expect(next.focusCount).toBe(1)
    })

    // an input that turns up much later is not one the user asked to focus
    test('a waiting focus is dropped after a second', () => {
      jest.useFakeTimers()
      const {composer, mount} = setup()
      const {another, attach, detach} = mount()
      detach()

      composer.focus()
      jest.advanceTimersByTime(1001)

      const next = another()
      attach(next)
      expect(next.focusCount).toBe(0)
    })

    test('a handle the ref replaces is picked up, and the text stays', () => {
      const {composer, mount} = setup()
      const {another, attach, detach, field} = mount()
      field.type('kept')
      const next = another()
      detach()
      attach(next)
      expect(composer.getText()).toBe('kept')

      composer.inject('to the new handle')

      expect(next.text).toBe('to the new handle')
    })
  })

  describe('typing and the saved draft', () => {
    test('what the user types is typing, and is saved', () => {
      const {drafts, mount, reports} = setup()
      const {field} = mount()

      field.type('h')

      expect(reports).toEqual([{text: 'h', typed: true}])
      expect(drafts).toEqual(['h'])
    })

    test('a draft loads as a write of the composer, and is not saved again', () => {
      const {drafts, mount, reports} = setup()

      mount('saved draft')

      expect(reports).toEqual([{text: 'saved draft', typed: false}])
      expect(drafts).toEqual([])
    })

    test('an inject is a write of the composer, saved as the draft because it changes it', () => {
      const {composer, drafts, mount, reports} = setup()
      mount('')

      composer.inject('shared text')

      expect(reports).toEqual([{text: 'shared text', typed: false}])
      expect(drafts).toEqual(['shared text'])
    })

    test('a write that leaves the saved draft as it is saves nothing', () => {
      const {composer, drafts, mount} = setup()
      mount('same')
      composer.inject('')
      drafts.length = 0

      composer.inject('')

      expect(drafts).toEqual([])
    })

    test('a user edit made through the composer (a pick, an insert) is typing', () => {
      const {composer, drafts, mount, reports} = setup()
      const {field} = mount()
      field.type('ab', 1)
      reports.length = 0
      drafts.length = 0

      composer.insertAtCaret('@')

      expect(reports).toEqual([{text: 'a@b', typed: true}])
      expect(drafts).toEqual(['a@b'])
    })
  })

  describe('an edit', () => {
    test('its text, and typing into it, is never saved, not even as the input goes away', () => {
      const {composer, drafts, mount} = setup()
      const {detach, field} = mount('my draft')

      composer.startEdit('my message')
      field.type('my message, fixed')
      detach()

      expect(field.text).toBe('my message, fixed')
      expect(drafts).toEqual(['flush'])
    })

    test('a clear ends it and puts back the draft it set aside, saving nothing; typing after is saved', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount('my draft')
      composer.startEdit('my message')
      field.type('my message, fixed')

      composer.clear()

      expect(field.text).toBe('my draft')
      expect(composer.getText()).toBe('my draft')
      expect(drafts).toEqual([])
      field.type('my draft!')
      expect(drafts).toEqual(['my draft!'])
    })

    test('a clear with no draft set aside leaves the composer empty, saving nothing', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount('')
      composer.startEdit('my message')

      composer.clear()

      expect(field.text).toBe('')
      expect(drafts).toEqual([])
    })

    test('a clear before any draft was known saves no empty draft over the one not yet loaded', () => {
      const {composer, drafts, mount} = setup()
      const {field, view} = mount(undefined)
      composer.startEdit('my message')

      composer.clear()
      expect(field.text).toBe('')
      expect(drafts).toEqual([])

      view.offerDraft('late draft')
      expect(field.text).toBe('late draft')
    })

    test('sending it hands over its text and puts back the draft, saving nothing', () => {
      jest.useFakeTimers()
      const {composer, drafts, mount, send} = setup()
      const {field} = mount('my draft')
      composer.startEdit('my message')
      field.type('my message, fixed')

      expect(composer.submit(send)).toBe(true)
      jest.runAllTimers()

      expect(send).toHaveBeenCalledWith('my message, fixed', noSnapshot)
      expect(field.text).toBe('my draft')
      expect(drafts).toEqual(['flush'])
    })

    test('a draft that arrives during it is set aside, and comes back when it ends', () => {
      const {composer, drafts, mount} = setup()
      const {field, view} = mount(undefined)
      composer.startEdit('my message')

      view.offerDraft('late draft')
      expect(field.text).toBe('my message')

      composer.clear()
      expect(field.text).toBe('late draft')
      expect(drafts).toEqual([])
    })

    test('started, cleared and started again with no input attached, the second edit is not saved either', () => {
      const {composer, drafts, mount} = setup()
      const {attach, detach, field} = mount('my draft')
      detach()
      drafts.length = 0

      composer.startEdit('first')
      composer.clear()
      composer.startEdit('second')
      attach()

      expect(field.text).toBe('second')
      expect(drafts).toEqual([])
    })

    test('with no edit, a clear empties the composer and saves the empty draft', () => {
      const {composer, drafts, mount} = setup()
      const {field} = mount('my draft')

      composer.clear()

      expect(field.text).toBe('')
      expect(drafts).toEqual([''])
    })
  })

  describe('read-only', () => {
    test('an inject, an insert and a typed insert reach neither the input nor the text', () => {
      const {composer, mount, setReadOnly} = setup()
      setReadOnly(true)
      // the inject's focus leaves the desktop input able to type the typed insert, were it let
      installInsertText()
      const {field} = mount()

      composer.inject('shared text', true)
      composer.insertAtCaret('@')
      composer.typeAtCaret('\n')

      expect(field.text).toBe('')
      expect(composer.getText()).toBe('')
    })

    test('a waiting inject does not land when the input attaches', () => {
      const {composer, mount, setReadOnly} = setup()
      setReadOnly(true)
      composer.inject('intent')

      const {field} = mount()

      expect(field.text).toBe('')
    })

    // the text was typed before the conversation turned read-only; a clear would save '' over it
    test('a submit sends nothing and leaves the text where it is', () => {
      jest.useFakeTimers()
      const {composer, mount, send, setReadOnly} = setup()
      const {field} = mount()
      field.type('typed before')
      const clear = jest.spyOn(field.handle, 'clear')
      setReadOnly(true)

      expect(composer.submit(send)).toBe(false)
      jest.runAllTimers()

      expect(send).not.toHaveBeenCalled()
      expect(clear).not.toHaveBeenCalled()
      expect(field.text).toBe('typed before')
      expect(composer.getText()).toBe('typed before')
    })

    // a stellar send the user cancels hands its text back after the send cleared it and its draft
    test("a restore puts the user's own text back, and reports it so it is saved again", () => {
      jest.useFakeTimers()
      const {composer, mount, reports, send, setReadOnly} = setup()
      const {field} = mount()
      field.type('+1xlm@testuser')
      composer.submit(send)
      jest.runAllTimers()
      setReadOnly(true)

      composer.restore('+1xlm@testuser')

      expect(field.text).toBe('+1xlm@testuser')
      expect(composer.getText()).toBe('+1xlm@testuser')
      expect(reports.at(-1)?.text).toBe('+1xlm@testuser')
    })

    test('a clear still clears, and leaves the saved draft alone', () => {
      const {composer, drafts, mount, setReadOnly} = setup()
      const {field} = mount()
      field.type('before')
      setReadOnly(true)

      composer.inject('')

      expect(field.text).toBe('')
      expect(composer.getText()).toBe('')
      expect(drafts).toEqual(['before'])
    })

    test('an edit is refused, and the composer is left as it was', () => {
      const {composer, drafts, mount, setReadOnly} = setup()
      const {field} = mount()
      setReadOnly(true)

      expect(composer.startEdit('my message')).toBe(false)

      expect(field.text).toBe('')
      expect(drafts).toEqual([])
    })

    test('an edit starts with its text once the composer can be written to', () => {
      const {composer, mount} = setup()
      const {field} = mount()

      expect(composer.startEdit('my message')).toBe(true)

      expect(field.text).toBe('my message')
    })

    test('writes land again once the composer can be written to', () => {
      const {composer, mount, setReadOnly} = setup()
      setReadOnly(true)
      const {field} = mount()
      setReadOnly(false)

      composer.inject('hello')

      expect(field.text).toBe('hello')
      expect(composer.getText()).toBe('hello')
    })

    test('a mounted read-only input does not get the draft', () => {
      const {composer, raw, setReadOnly} = setup()
      setReadOnly(true)

      const {container} = render(
        <ComposerContext value={raw}>
          <InputView draft="saved" readOnly={true} />
        </ComposerContext>
      )

      expect(container.querySelector('textarea')!.value).toBe('')
      expect(composer.getText()).toBe('')
    })

    // The store turns read-only before React renders it, and an input handle is set in the commit's
    // layout phase, ahead of every passive effect: a draft offered there must already see it.
    test('a draft that arrives with read-only as the input gets a new handle is not written', () => {
      const {composer, raw, setReadOnly} = setup()
      const view = (inputKey: string, draft: string | undefined, readOnly: boolean) => (
        <ComposerContext value={raw}>
          <InputView draft={draft} inputKey={inputKey} readOnly={readOnly} />
        </ComposerContext>
      )
      const {container, rerender} = render(view('first', undefined, false))

      setReadOnly(true)
      rerender(view('second', 'saved', true))

      expect(container.querySelector('textarea')!.value).toBe('')
      expect(composer.getText()).toBe('')
    })

    test('a draft kept out while read-only loads once the user can post', () => {
      const {composer, raw, setReadOnly} = setup()
      setReadOnly(true)
      const view = (readOnly: boolean) => (
        <ComposerContext value={raw}>
          <InputView draft="saved" readOnly={readOnly} />
        </ComposerContext>
      )
      const {container, rerender} = render(view(true))
      const field = drive(kit, container.querySelector('textarea')!)
      expect(field.text).toBe('')

      setReadOnly(false)
      rerender(view(false))

      expect(field.text).toBe('saved')
      expect(composer.getText()).toBe('saved')
    })
  })
})

// What only one of the two inputs does: the desktop textarea shows a write it does not report (a
// suggestion preview) and, focused, types an insert itself; the native TextInput shows only what it
// reports, and has no caret until it reports one.
describe('the desktop input', () => {
  const setup = (opts?: Parameters<typeof makeSetup>[1]) => makeSetup(desktop, opts)

  test('a preview write is shown and readable without being reported as typed', () => {
    const {composer, mount, reports} = setup()
    const {field} = mount()
    field.type('hi @te')
    reports.length = 0

    expect(composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, false)).toBe(true)

    expect(composer.getText()).toBe('hi @testuser')
    expect(field.text).toBe('hi @testuser')
    expect(field.selection).toEqual({end: 12, start: 12})
    expect(reports).toEqual([])
  })

  test('focused, it types an insert itself, and its report is the new text', () => {
    installInsertText()
    const {composer, mount, reports} = setup()
    const {field} = mount()
    field.type('abcd', 2)
    field.focus()
    reports.length = 0
    const replaceText = jest.spyOn(field.handle, 'replaceText')

    composer.typeAtCaret('\n')

    expect(replaceText).not.toHaveBeenCalled()
    expect(field.text).toBe('ab\ncd')
    expect(field.selection).toEqual({end: 3, start: 3})
    expect(composer.getText()).toBe('ab\ncd')
    expect(reports).toEqual([{text: 'ab\ncd', typed: true}])
  })

  // the browser types into whatever is focused, which here is another field
  test('not focused, it cannot type an insert, so the composer splices it in at the caret', () => {
    installInsertText()
    const {composer, mount, reports} = setup()
    const {field} = mount()
    field.type('abcd', 2)
    const elsewhere = renderField(desktop, () => {})
    elsewhere.focus()
    reports.length = 0
    const replaceText = jest.spyOn(field.handle, 'replaceText')

    composer.typeAtCaret('\n')

    expect(replaceText).toHaveBeenCalledTimes(1)
    expect(field.text).toBe('ab\ncd')
    expect(elsewhere.text).toBe('')
    expect(reports).toEqual([{text: 'ab\ncd', typed: true}])
  })
})

describe('the native input', () => {
  const setup = (opts?: Parameters<typeof makeSetup>[1]) => makeSetup(native, opts)
  beforeAll(() => {
    setGlobals(native.globals)
  })
  afterAll(() => {
    setGlobals(desktop.globals)
  })

  test('a preview it does not show leaves the text, so a send sends what is shown', () => {
    jest.useFakeTimers()
    const {composer, mount, send} = setup()
    const {field} = mount()
    field.type('hi @te')

    expect(composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, false)).toBe(false)

    expect(field.text).toBe('hi @te')
    expect(composer.getText()).toBe('hi @te')
    composer.submit(send)
    jest.runAllTimers()
    expect(send).toHaveBeenCalledWith('hi @te', noSnapshot)
  })

  test('with no caret reported an insert goes at the end', () => {
    const {composer, mount} = setup()
    const {field} = mount()
    field.typeWithoutCaret('abcd')
    expect(composer.getSelection()).toBeUndefined()

    composer.insertAtCaret(':+1: ')

    expect(field.text).toBe('abcd:+1: ')
    expect(field.selection).toEqual({end: 9, start: 9})
  })

  // a replace may carry a caret with no end, which the input then reports back
  test('a caret with no end inserts at the caret', () => {
    const {composer, mount} = setup()
    const {field} = mount()
    composer.replace({selection: {start: 2}, text: 'abcd'}, true)
    expect(composer.getSelection()).toEqual({start: 2})

    composer.insertAtCaret('X')

    expect(field.text).toBe('abXcd')
    expect(field.selection).toEqual({end: 3, start: 3})
  })

  test('it never types an insert itself: the composer splices it in at the caret, as typing', () => {
    installInsertText()
    const {composer, mount, reports} = setup()
    const {field} = mount()
    field.type('abcd', 2)
    field.focus()
    reports.length = 0
    const replaceText = jest.spyOn(field.handle, 'replaceText')

    composer.typeAtCaret('\n')

    expect(replaceText).toHaveBeenCalledTimes(1)
    expect(field.text).toBe('ab\ncd')
    expect(reports).toEqual([{text: 'ab\ncd', typed: true}])
  })
})
