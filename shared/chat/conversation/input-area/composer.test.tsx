/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import logger from '@/logger'
import {ComposerContext, makeComposer, useComposerInput} from './composer'
import {FakeComposerInputView, makeFakeComposerInput, type FakeComposerInput} from '@/test/fake-composer-input'
import type {SuppressSnapshot} from '../unfurl-preview-state'

const noSnapshot: SuppressSnapshot = {dismissed: [], failed: []}

const setup = (opts?: {takeUnfurlSnapshot?: () => SuppressSnapshot}) => {
  const send = jest.fn()
  // what the composer saves as the draft ('flush' where it asks for a pending save to go now),
  // and every report the attached input makes, with whether the composer took it as typing
  const drafts: Array<string> = []
  const reports: Array<{text: string; typed: boolean}> = []
  // stands in for the conversation's cannotWrite in the inbox metadata store
  let readOnly = false
  const composer = makeComposer({
    flushDraft: () => {
      drafts.push('flush')
    },
    isReadOnly: () => readOnly,
    saveDraft: text => {
      drafts.push(text)
    },
    takeUnfurlSnapshot: opts?.takeUnfurlSnapshot ?? (() => noSnapshot),
  })
  // one mounted composer view: its fake input's reports go to the composer, and the draft is
  // offered as the view is made, as useComposerInput wires them
  const mount = (draft?: string) => {
    const fake = makeFakeComposerInput()
    const view = composer.connect()
    view.offerDraft(draft)
    fake.connect(text => {
      reports.push({text, typed: view.textChanged(text)})
    })
    const attach = (input: FakeComposerInput = fake) => {
      view.setInput(input)
    }
    attach()
    return {attach, detach: () => view.setInput(null), fake, view}
  }
  const setReadOnly = (next: boolean) => {
    readOnly = next
  }
  return {composer, drafts, mount, reports, send, setReadOnly}
}

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('text', () => {
  test('starts empty and follows what the input reports', () => {
    const {composer, mount} = setup()
    expect(composer.getText()).toBe('')
    const {fake} = mount()

    fake.type('hello')

    expect(composer.getText()).toBe('hello')
  })

  test('a report from an input that is no longer attached is ignored', () => {
    const {composer, mount} = setup()
    const first = mount()
    first.detach()
    mount()

    first.fake.type('late echo from the old input')

    expect(composer.getText()).toBe('')
  })

  test('stays readable after the input detaches', () => {
    const {composer, mount} = setup()
    const {detach, fake} = mount()
    fake.type('still here')

    detach()

    expect(composer.getText()).toBe('still here')
  })
})

describe('inject', () => {
  test('replaces the whole text with the caret at the end and echoes it', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('old')

    composer.inject('new text')

    expect(fake.text).toBe('new text')
    expect(fake.selection).toEqual({end: 8, start: 8})
    expect(composer.getText()).toBe('new text')
    expect(fake.focusCount).toBe(0)
  })

  test('focuses only when asked', () => {
    const {composer, mount} = setup()
    const {fake} = mount()

    composer.inject('a', true)
    composer.inject('b')

    expect(fake.focusCount).toBe(1)
  })

  test('selects the placeholder inside the spoiler markup', () => {
    const {composer, mount} = setup()
    const {fake} = mount()

    composer.inject('!>spoiler<!')

    expect(fake.selection).toEqual({end: 9, start: 2})
  })

  test('an empty text goes through clear', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('something')
    const replaceText = jest.spyOn(fake, 'replaceText')
    const clear = jest.spyOn(fake, 'clear')

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
    const {fake} = mount()

    expect(fake.text).toBe('second')
    expect(fake.focusCount).toBe(1)
    expect(composer.getText()).toBe('second')
  })

  test('a waiting text and its focus land once', () => {
    const {composer, mount} = setup()
    composer.inject('once', true)
    const first = mount()
    first.detach()

    const second = mount()

    expect(first.fake.focusCount).toBe(1)
    expect(second.fake.text).toBe('')
    expect(second.fake.focusCount).toBe(0)
  })

  test('a waiting inject without focus does not focus on attach', () => {
    const {composer, mount} = setup()
    composer.inject('quiet')

    const {fake} = mount()

    expect(fake.text).toBe('quiet')
    expect(fake.focusCount).toBe(0)
  })

  test('an input whose ref is emptied is detached: the text waits for it and lands when it is set again', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount()
    fake.type('kept')
    detach()

    composer.inject('not lost')
    expect(fake.text).toBe('kept')
    attach()

    expect(fake.text).toBe('not lost')
    expect(composer.getText()).toBe('not lost')
  })
})

describe('draft', () => {
  test('loads into an untouched composer on attach', () => {
    const {composer, mount} = setup()

    const {fake} = mount('saved')

    expect(fake.text).toBe('saved')
    expect(fake.selection).toEqual({end: 5, start: 5})
    expect(composer.getText()).toBe('saved')
  })

  test('loads once, when it first arrives', () => {
    const {mount} = setup()
    const {fake, view} = mount(undefined)

    view.offerDraft('arrived')
    view.offerDraft('arrived again, changed')

    expect(fake.text).toBe('arrived')
  })

  test('does not overwrite text already typed', () => {
    const {mount} = setup()
    const {fake, view} = mount(undefined)
    fake.type('typed')

    view.offerDraft('stale')

    expect(fake.text).toBe('typed')
  })

  test('an empty draft counts as loaded', () => {
    const {mount} = setup()
    const {fake, view} = mount('')

    view.offerDraft('later')

    expect(fake.text).toBe('')
  })

  test('waits while the input has no handle, and loads once it has one', () => {
    const {composer, mount} = setup()
    const {detach, fake, view} = mount(undefined)
    detach()

    view.offerDraft('saved')
    expect(fake.text).toBe('')
    view.setInput(fake)

    expect(fake.text).toBe('saved')
    expect(composer.getText()).toBe('saved')
  })

  // a new ref callback on a render makes React clear the old one and set the new one
  test('the ref setter stays the same across renders, whatever the draft', () => {
    const {composer} = setup()
    const wrapper = (p: {children: React.ReactNode}) => (
      <ComposerContext value={composer}>{p.children}</ComposerContext>
    )
    const {rerender, result} = renderHook((p: {draft?: string}) => useComposerInput<FakeComposerInput>(p.draft, false), {
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
    const {composer} = setup()
    const wrapper = (p: {children: React.ReactNode}) => (
      <ComposerContext value={composer}>{p.children}</ComposerContext>
    )
    const {result} = renderHook(() => useComposerInput<FakeComposerInput>('saved', false), {wrapper})
    expect(composer.getText()).toBe('')
    const fake = makeFakeComposerInput()

    act(() => {
      result.current.setInput(fake)
    })

    expect(fake.text).toBe('saved')
    expect(composer.getText()).toBe('saved')
  })

  test('an offer from an input that is not attached is ignored', () => {
    const {composer, mount} = setup()
    const first = mount(undefined)

    composer.connect().offerDraft('saved')

    expect(first.fake.text).toBe('')
    first.view.offerDraft('saved')
    expect(first.fake.text).toBe('saved')
  })

  test('a waiting inject is applied after the draft, so it wins', () => {
    const {composer, mount} = setup()
    composer.inject('intent')

    const {fake} = mount('saved')

    expect(fake.text).toBe('intent')
  })

  test('a waiting empty inject clears the draft it follows', () => {
    const {composer, mount} = setup()
    composer.inject('')

    const {fake} = mount('saved')

    expect(fake.text).toBe('')
    expect(composer.getText()).toBe('')
  })

  test('re-attaching the same input keeps its text and does not reload the draft', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount('saved')
    fake.type('edited')
    detach()

    attach()

    expect(fake.text).toBe('edited')
    expect(composer.getText()).toBe('edited')
  })

  test('a different input starts over: no text, and its draft loads', () => {
    const {composer, mount} = setup()
    const first = mount('saved')
    first.fake.type('edited')
    first.detach()

    const second = mount('saved on unmount')

    expect(second.fake.text).toBe('saved on unmount')
    expect(composer.getText()).toBe('saved on unmount')
  })
})

describe('insertAtCaret', () => {
  test('splices at the caret and parks the caret after the insert', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd', 2)

    composer.insertAtCaret('@')

    expect(fake.text).toBe('ab@cd')
    expect(fake.selection).toEqual({end: 3, start: 3})
    expect(composer.getText()).toBe('ab@cd')
  })

  test('replaces a selected range', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd')
    fake.selection = {end: 3, start: 1}

    composer.insertAtCaret('\n')

    expect(fake.text).toBe('a\nd')
    expect(fake.selection).toEqual({end: 2, start: 2})
  })

  test('with no caret reported inserts at the end', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd')
    fake.selection = undefined

    composer.insertAtCaret(':+1: ')

    expect(fake.text).toBe('abcd:+1: ')
    expect(fake.selection).toEqual({end: 9, start: 9})
  })

  test('a caret with no end inserts at the caret', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd')
    fake.selection = {start: 2}

    composer.insertAtCaret('X')

    expect(fake.text).toBe('abXcd')
    expect(fake.selection).toEqual({end: 3, start: 3})
  })

  test('the insert is reported like typing', () => {
    const {composer, mount} = setup()
    const {fake, view} = mount()
    const reports: Array<string> = []
    fake.connect(text => {
      reports.push(text)
      view.textChanged(text)
    })

    composer.insertAtCaret('x')

    expect(reports).toEqual(['x'])
  })

  // effects mount children first, so a child's insert can come before its input attaches
  test('waits while no input is attached and lands at the caret once it attaches again', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount()
    fake.type('abcd', 2)
    detach()

    composer.insertAtCaret('x')
    expect(fake.text).toBe('abcd')
    attach()

    expect(fake.text).toBe('abxcd')
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
  const {composer, send} = setup()
  const fake = makeFakeComposerInput()
  const SendInCommit = (p: {hidden: boolean}) => {
    const {hidden} = p
    React.useLayoutEffect(() => {
      if (hidden) composer.submit(send)
    }, [hidden])
    return null
  }
  const tree = (mode: 'hidden' | 'visible') => (
    <ComposerContext value={composer}>
      <React.Activity mode={mode}>
        <FakeComposerInputView fake={fake} />
      </React.Activity>
      <SendInCommit hidden={mode === 'hidden'} />
    </ComposerContext>
  )
  const {rerender} = render(tree('visible'))
  act(() => {
    fake.type('hello')
  })

  rerender(tree('hidden'))
  jest.advanceTimersByTime(0)
  expect(send).toHaveBeenCalledWith('hello', noSnapshot)
  expect(fake.text).toBe('hello')
  rerender(tree('visible'))

  expect(fake.text).toBe('')
  expect(composer.getText()).toBe('')
})

// A hidden Activity (a screen kept but not shown) unmounts every effect, and showing it again
// mounts them children first, so a child writes before its composer view attaches the input.
test('an insert a child makes as its hidden screen is shown lands once the input attaches', () => {
  const {composer} = setup()
  const fake = makeFakeComposerInput()
  const Inserter = (p: {pick: string}) => {
    const {pick} = p
    React.useEffect(() => {
      if (pick) composer.insertAtCaret(pick)
    }, [pick])
    return null
  }
  const tree = (mode: 'hidden' | 'visible', pick: string) => (
    <ComposerContext value={composer}>
      <React.Activity mode={mode}>
        <FakeComposerInputView fake={fake}>
          <Inserter pick={pick} />
        </FakeComposerInputView>
      </React.Activity>
    </ComposerContext>
  )
  const {rerender} = render(tree('visible', ''))
  act(() => {
    fake.type('abcd', 2)
  })
  rerender(tree('hidden', ''))
  rerender(tree('hidden', ':smile: '))
  expect(fake.text).toBe('abcd')

  rerender(tree('visible', ':smile: '))

  expect(fake.text).toBe('ab:smile: cd')
  expect(composer.getText()).toBe('ab:smile: cd')
})

describe('typeAtCaret', () => {
  test('an input that can type the text does it itself, and its report is the new text', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.typesText = true
    fake.type('abcd', 2)
    const replaceText = jest.spyOn(fake, 'replaceText')

    composer.typeAtCaret('\n')

    expect(replaceText).not.toHaveBeenCalled()
    expect(fake.text).toBe('ab\ncd')
    expect(composer.getText()).toBe('ab\ncd')
  })

  test('an input that cannot type it gets it inserted at the caret', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd', 2)

    composer.typeAtCaret('\n')

    expect(fake.text).toBe('ab\ncd')
    expect(fake.selection).toEqual({end: 3, start: 3})
    expect(composer.getText()).toBe('ab\ncd')
  })

  test('waits while no input is attached and lands once it attaches again', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount()
    fake.type('abc')
    detach()

    composer.typeAtCaret('\n')
    expect(composer.getText()).toBe('abc')
    attach()

    expect(composer.getText()).toBe('abc\n')
  })
})

describe('replace', () => {
  test('a preview write is readable without being reported as typed', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('hi @te')
    const reports: Array<string> = []
    fake.connect(text => reports.push(text))

    composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, false)

    expect(composer.getText()).toBe('hi @testuser')
    expect(fake.text).toBe('hi @testuser')
    expect(reports).toEqual([])
  })

  test('a preview the input does not show leaves the text, so a send sends what is shown', () => {
    jest.useFakeTimers()
    const {composer, mount, send} = setup()
    const {fake} = mount()
    fake.showsPreviews = false
    fake.type('hi @te')

    composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, false)

    expect(fake.text).toBe('hi @te')
    expect(composer.getText()).toBe('hi @te')
    composer.submit(send)
    jest.runAllTimers()
    expect(send).toHaveBeenCalledWith('hi @te', noSnapshot)
  })
  // the text it carries was worked out from the text the old view had
  test('a replace waiting from one view is dropped when another view attaches, so its draft stands', () => {
    const {composer, mount} = setup()
    const first = mount()
    first.fake.type('hi @te')
    first.detach()

    composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, true)
    const second = mount('saved')

    expect(second.fake.text).toBe('saved')
    expect(composer.getText()).toBe('saved')
  })

  test('a replace waiting from a view lands when that view attaches again', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount()
    fake.type('hi @te')
    detach()

    composer.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, true)
    attach()

    expect(fake.text).toBe('hi @testuser')
    expect(composer.getText()).toBe('hi @testuser')
  })
})

describe('submit', () => {
  test('saves an empty draft now, with no input attached as with one', () => {
    const {composer, drafts, mount, send} = setup()
    const {detach, fake} = mount()
    fake.type('hello')
    detach()

    composer.submit(send)

    expect(drafts).toEqual(['hello', 'flush', '', 'flush'])
  })

  test('with nothing typed sends nothing and leaves the input alone', () => {
    jest.useFakeTimers()
    const {composer, mount, send} = setup()
    const {fake} = mount()

    expect(composer.submit(send)).toBe(false)
    jest.runAllTimers()

    expect(send).not.toHaveBeenCalled()
    expect(fake.focusCount).toBe(0)
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
    const {fake} = mount()
    fake.type('look at http://a.com')
    const clear = fake.clear
    fake.clear = () => {
      order.push('clear')
      clear()
    }
    expect(composer.submit(send)).toBe(true)

    expect(order).toEqual(['snapshot', 'clear'])
    expect(fake.text).toBe('')
    expect(fake.focusCount).toBe(1)
    expect(composer.getText()).toBe('')
    expect(send).not.toHaveBeenCalled()

    jest.advanceTimersByTime(0)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('look at http://a.com', snapshot)
  })

  test('sends the text as it was when submitted, whatever is typed before the send runs', () => {
    jest.useFakeTimers()
    const {composer, mount, send} = setup()
    const {fake} = mount()
    fake.type('first')

    composer.submit(send)
    fake.type('second')
    jest.advanceTimersByTime(0)

    expect(send).toHaveBeenCalledWith('first', noSnapshot)
  })

  // the draft the next input loads is the one saved as the old input unmounted, the text just
  // sent; the clear waiting for that input is newer, so it wins
  test('after the input detaches still sends, without an error, and the next input starts empty', () => {
    jest.useFakeTimers()
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {composer, mount, send} = setup()
    const {detach, fake} = mount()
    fake.type('queued before unmount')
    detach()

    expect(composer.submit(send)).toBe(true)
    expect(composer.getText()).toBe('')
    jest.advanceTimersByTime(0)

    expect(error).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith('queued before unmount', noSnapshot)
    expect(composer.getText()).toBe('')
    const next = mount('queued before unmount')

    expect(next.fake.text).toBe('')
    expect(composer.getText()).toBe('')
  })
})

describe('the input it reads through', () => {
  test('selection, focus and focusing go to the attached input', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abc', 1)

    composer.focus()

    expect(composer.getSelection()).toEqual({end: 1, start: 1})
    expect(composer.isFocused()).toBe(true)
    expect(fake.focusCount).toBe(1)
  })

  test('with nothing attached there is no selection, and a focus waits for the next input', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount()
    fake.type('abc')
    fake.focus()
    detach()

    composer.focus()

    expect(composer.getSelection()).toBeUndefined()
    expect(composer.isFocused()).toBe(false)
    expect(fake.focusCount).toBe(1)
    const next = makeFakeComposerInput()
    attach(next)
    expect(next.focusCount).toBe(1)
  })

  test('focus asked for again and again while nothing is attached focuses the next input once', () => {
    const {composer, mount} = setup()
    const {attach, detach} = mount()
    detach()

    composer.focus()
    composer.focus()
    composer.focus()

    const next = makeFakeComposerInput()
    attach(next)
    expect(next.focusCount).toBe(1)
  })

  // an input that turns up much later is not one the user asked to focus
  test('a waiting focus is dropped after a second', () => {
    jest.useFakeTimers()
    const {composer, mount} = setup()
    const {attach, detach} = mount()
    detach()

    composer.focus()
    jest.advanceTimersByTime(1001)

    const next = makeFakeComposerInput()
    attach(next)
    expect(next.focusCount).toBe(0)
  })

  test('a handle the ref replaces is picked up, and the text stays', () => {
    const {composer, mount} = setup()
    const {attach, detach, fake} = mount()
    fake.type('kept')
    const next = makeFakeComposerInput()
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
    const {fake} = mount()

    fake.type('h')

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
    const {fake} = mount()
    fake.type('ab', 1)
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
    const {detach, fake} = mount('my draft')

    composer.startEdit('my message')
    fake.type('my message, fixed')
    detach()

    expect(fake.text).toBe('my message, fixed')
    expect(drafts).toEqual(['flush'])
  })

  test('a clear ends it and puts back the draft it set aside, saving nothing; typing after is saved', () => {
    const {composer, drafts, mount} = setup()
    const {fake} = mount('my draft')
    composer.startEdit('my message')
    fake.type('my message, fixed')

    composer.clear()

    expect(fake.text).toBe('my draft')
    expect(composer.getText()).toBe('my draft')
    expect(drafts).toEqual([])
    fake.type('my draft!')
    expect(drafts).toEqual(['my draft!'])
  })

  test('a clear with no draft set aside leaves the composer empty, saving nothing', () => {
    const {composer, drafts, mount} = setup()
    const {fake} = mount('')
    composer.startEdit('my message')

    composer.clear()

    expect(fake.text).toBe('')
    expect(drafts).toEqual([])
  })

  test('a clear before any draft was known saves no empty draft over the one not yet loaded', () => {
    const {composer, drafts, mount} = setup()
    const {fake, view} = mount(undefined)
    composer.startEdit('my message')

    composer.clear()
    expect(fake.text).toBe('')
    expect(drafts).toEqual([])

    view.offerDraft('late draft')
    expect(fake.text).toBe('late draft')
  })

  test('sending it hands over its text and puts back the draft, saving nothing', () => {
    jest.useFakeTimers()
    const {composer, drafts, mount, send} = setup()
    const {fake} = mount('my draft')
    composer.startEdit('my message')
    fake.type('my message, fixed')

    expect(composer.submit(send)).toBe(true)
    jest.runAllTimers()

    expect(send).toHaveBeenCalledWith('my message, fixed', noSnapshot)
    expect(fake.text).toBe('my draft')
    expect(drafts).toEqual(['flush'])
  })

  test('a draft that arrives during it is set aside, and comes back when it ends', () => {
    const {composer, drafts, mount} = setup()
    const {fake, view} = mount(undefined)
    composer.startEdit('my message')

    view.offerDraft('late draft')
    expect(fake.text).toBe('my message')

    composer.clear()
    expect(fake.text).toBe('late draft')
    expect(drafts).toEqual([])
  })

  test('started, cleared and started again with no input attached, the second edit is not saved either', () => {
    const {composer, drafts, mount} = setup()
    const {attach, detach, fake} = mount('my draft')
    detach()
    drafts.length = 0

    composer.startEdit('first')
    composer.clear()
    composer.startEdit('second')
    attach()

    expect(fake.text).toBe('second')
    expect(drafts).toEqual([])
  })

  test('with no edit, a clear empties the composer and saves the empty draft', () => {
    const {composer, drafts, mount} = setup()
    const {fake} = mount('my draft')

    composer.clear()

    expect(fake.text).toBe('')
    expect(drafts).toEqual([''])
  })
})

describe('read-only', () => {
  test('an inject, an insert and a typed insert reach neither the input nor the text', () => {
    const {composer, mount, setReadOnly} = setup()
    setReadOnly(true)
    const {fake} = mount()
    fake.typesText = true

    composer.inject('shared text', true)
    composer.insertAtCaret('@')
    composer.typeAtCaret('\n')

    expect(fake.text).toBe('')
    expect(composer.getText()).toBe('')
  })

  test('a waiting inject does not land when the input attaches', () => {
    const {composer, mount, setReadOnly} = setup()
    setReadOnly(true)
    composer.inject('intent')

    const {fake} = mount()

    expect(fake.text).toBe('')
  })

  // the text was typed before the conversation turned read-only; a clear would save '' over it
  test('a submit sends nothing and leaves the text where it is', () => {
    jest.useFakeTimers()
    const {composer, mount, send, setReadOnly} = setup()
    const {fake} = mount()
    fake.type('typed before')
    const clear = jest.spyOn(fake, 'clear')
    setReadOnly(true)

    expect(composer.submit(send)).toBe(false)
    jest.runAllTimers()

    expect(send).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(fake.text).toBe('typed before')
    expect(composer.getText()).toBe('typed before')
  })

  // a stellar send the user cancels hands its text back after the send cleared it and its draft
  test("a restore puts the user's own text back, and reports it so it is saved again", () => {
    jest.useFakeTimers()
    const {composer, mount, send, setReadOnly} = setup()
    const {fake, view} = mount()
    const reports: Array<string> = []
    fake.connect(text => {
      reports.push(text)
      view.textChanged(text)
    })
    fake.type('+1xlm@testuser')
    composer.submit(send)
    jest.runAllTimers()
    setReadOnly(true)

    composer.restore('+1xlm@testuser')

    expect(fake.text).toBe('+1xlm@testuser')
    expect(composer.getText()).toBe('+1xlm@testuser')
    expect(reports.at(-1)).toBe('+1xlm@testuser')
  })

  test('a clear still clears, and leaves the saved draft alone', () => {
    const {composer, drafts, mount, setReadOnly} = setup()
    const {fake} = mount()
    fake.type('before')
    setReadOnly(true)

    composer.inject('')

    expect(fake.text).toBe('')
    expect(composer.getText()).toBe('')
    expect(drafts).toEqual(['before'])
  })

  test('an edit is refused, and the composer is left as it was', () => {
    const {composer, drafts, mount, setReadOnly} = setup()
    const {fake} = mount()
    setReadOnly(true)

    expect(composer.startEdit('my message')).toBe(false)

    expect(fake.text).toBe('')
    expect(drafts).toEqual([])
  })

  test('an edit starts with its text once the composer can be written to', () => {
    const {composer, mount} = setup()
    const {fake} = mount()

    expect(composer.startEdit('my message')).toBe(true)

    expect(fake.text).toBe('my message')
  })

  test('a reply is refused', () => {
    const {composer, setReadOnly} = setup()
    expect(composer.startReply()).toBe(true)
    setReadOnly(true)

    expect(composer.startReply()).toBe(false)
  })

  test('writes land again once the composer can be written to', () => {
    const {composer, mount, setReadOnly} = setup()
    setReadOnly(true)
    const {fake} = mount()
    setReadOnly(false)

    composer.inject('hello')

    expect(fake.text).toBe('hello')
    expect(composer.getText()).toBe('hello')
  })

  test('a mounted read-only input does not get the draft', () => {
    const {composer, setReadOnly} = setup()
    setReadOnly(true)
    const fake = makeFakeComposerInput()

    render(
      <ComposerContext value={composer}>
        <FakeComposerInputView draft="saved" fake={fake} readOnly={true} />
      </ComposerContext>
    )

    expect(fake.text).toBe('')
    expect(composer.getText()).toBe('')
  })

  // The store turns read-only before React renders it, and an input handle is set in the commit's
  // layout phase, ahead of every passive effect: a draft offered there must already see it.
  test('a draft that arrives with read-only as the input gets a new handle is not written', () => {
    const {composer, setReadOnly} = setup()
    const first = makeFakeComposerInput()
    const second = makeFakeComposerInput()
    const view = (fake: FakeComposerInput, draft: string | undefined, readOnly: boolean) => (
      <ComposerContext value={composer}>
        <FakeComposerInputView draft={draft} fake={fake} readOnly={readOnly} />
      </ComposerContext>
    )
    const {rerender} = render(view(first, undefined, false))

    setReadOnly(true)
    rerender(view(second, 'saved', true))

    expect(second.text).toBe('')
    expect(composer.getText()).toBe('')
  })

  test('a draft kept out while read-only loads once the user can post', () => {
    const {composer, setReadOnly} = setup()
    setReadOnly(true)
    const fake = makeFakeComposerInput()
    const view = (readOnly: boolean) => (
      <ComposerContext value={composer}>
        <FakeComposerInputView draft="saved" fake={fake} readOnly={readOnly} />
      </ComposerContext>
    )
    const {rerender} = render(view(true))
    expect(fake.text).toBe('')

    setReadOnly(false)
    rerender(view(false))

    expect(fake.text).toBe('saved')
    expect(composer.getText()).toBe('saved')
  })
})
