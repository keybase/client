/// <reference types="jest" />
import logger from '@/logger'
import {makeComposer} from './composer'
import {makeFakeComposerInput, type FakeComposerInput} from './composer-fake-input'
import type {SuppressSnapshot} from '../unfurl-preview-state'

const noSnapshot: SuppressSnapshot = {dismissed: [], failed: []}

const setup = (opts?: {takeUnfurlSnapshot?: () => SuppressSnapshot}) => {
  const send = jest.fn()
  const composer = makeComposer({takeUnfurlSnapshot: opts?.takeUnfurlSnapshot ?? (() => noSnapshot)})
  // one mounted input: a fake whose reports go to the composer, as the composer view wires them
  const mount = (draft?: string) => {
    const fake = makeFakeComposerInput()
    const ref: {current: FakeComposerInput | null} = {current: fake}
    fake.connect(text => composer.textChanged(ref, text))
    const detach = composer.attach(ref, draft)
    return {detach, fake, ref}
  }
  return {composer, mount, send}
}

afterEach(() => {
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

  test('waits while no input is attached and the last text lands on attach, without focus', () => {
    const {composer, mount} = setup()

    composer.inject('first', true)
    composer.inject('second')
    expect(composer.getText()).toBe('')
    const {fake} = mount()

    expect(fake.text).toBe('second')
    expect(fake.focusCount).toBe(0)
    expect(composer.getText()).toBe('second')
  })

  test('a waiting text lands once', () => {
    const {composer, mount} = setup()
    composer.inject('once')
    const first = mount()
    first.detach()

    const second = mount()

    expect(second.fake.text).toBe('')
  })

  test('an attached input whose ref is empty drops the text and says so', () => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {composer, mount} = setup()
    const {fake, ref} = mount()
    fake.type('kept')
    ref.current = null

    composer.inject('lost')

    expect(error).toHaveBeenCalledWith('[chat] injectText dropped: input ref is null')
    expect(composer.getText()).toBe('kept')
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
    const {composer, mount} = setup()
    const {fake} = mount(undefined)

    composer.offerDraft('arrived')
    composer.offerDraft('arrived again, changed')

    expect(fake.text).toBe('arrived')
  })

  test('does not overwrite text already typed', () => {
    const {composer, mount} = setup()
    const {fake} = mount(undefined)
    fake.type('typed')

    composer.offerDraft('stale')

    expect(fake.text).toBe('typed')
  })

  test('an empty draft counts as loaded', () => {
    const {composer, mount} = setup()
    const {fake} = mount('')

    composer.offerDraft('later')

    expect(fake.text).toBe('')
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
    const {detach, fake, ref} = mount('saved')
    fake.type('edited')
    detach()

    composer.attach(ref, 'saved')

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

  test('with no caret reported inserts at the start', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd')
    fake.selection = undefined

    composer.insertAtCaret(':+1: ')

    expect(fake.text).toBe(':+1: abcd')
  })

  test('a caret with no end takes the text from 0 as the rest', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd')
    fake.selection = {start: 2}

    composer.insertAtCaret('X')

    expect(fake.text).toBe('abXabcd')
  })

  test('appendSpaceToText puts the space at the end of the text, not after the insert', () => {
    const {composer, mount} = setup()
    const {fake} = mount()
    fake.type('abcd', 2)

    composer.insertAtCaret(':smile:', {appendSpaceToText: true})

    expect(fake.text).toBe('ab:smile:cd ')
    expect(fake.selection).toEqual({end: 10, start: 10})
  })

  test('the insert is reported like typing', () => {
    const {composer, mount} = setup()
    const {fake, ref} = mount()
    const reports: Array<string> = []
    fake.connect(text => {
      reports.push(text)
      composer.textChanged(ref, text)
    })

    composer.insertAtCaret('x')

    expect(reports).toEqual(['x'])
  })

  test('does nothing with no input attached', () => {
    const {composer, mount} = setup()
    const {detach, fake} = mount()
    fake.type('abc')
    detach()

    composer.insertAtCaret('x')

    expect(fake.text).toBe('abc')
    expect(composer.getText()).toBe('abc')
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
})

describe('submit', () => {
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

  test('after the input detaches still sends, with the clear dropped', () => {
    jest.useFakeTimers()
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {composer, mount, send} = setup()
    const {detach, fake} = mount()
    fake.type('queued before unmount')
    detach()

    expect(composer.submit(send)).toBe(true)
    jest.advanceTimersByTime(0)

    expect(error).toHaveBeenCalledWith('[chat] injectText dropped: input ref is null')
    expect(send).toHaveBeenCalledWith('queued before unmount', noSnapshot)
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

  test('with nothing attached there is no selection and no focus', () => {
    const {composer, mount} = setup()
    const {detach, fake} = mount()
    fake.type('abc')
    fake.focus()
    detach()

    composer.focus()

    expect(composer.getSelection()).toBeUndefined()
    expect(composer.isFocused()).toBe(false)
    expect(fake.focusCount).toBe(1)
  })

  test('the input the composer holds is the ref, so a replaced handle is picked up', () => {
    const {composer, mount} = setup()
    const {ref} = mount()
    const next = makeFakeComposerInput()
    ref.current = next

    composer.inject('to the new handle')

    expect(next.text).toBe('to the new handle')
  })
})
