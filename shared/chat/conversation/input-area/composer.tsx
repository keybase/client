import * as React from 'react'
import logger from '@/logger'
import type {SuppressSnapshot} from '../unfurl-preview-state'
import type {Selection, TextInfo} from './normal/input.shared'

// The platform input the composer writes through: the desktop textarea, the native TextInput,
// or a fake in tests. The input keeps its own copy of the text for rendering; the composer is
// what everything else reads.
export type ComposerInput = {
  clear: () => void
  focus: () => void
  getSelection: () => Selection | undefined
  isFocused: () => boolean
  // reflectChange: echo the new text back through the input's onChangeText, as typing would
  replaceText: (info: TextInfo, reflectChange: boolean) => void
}
export type ComposerInputRef = {readonly current: ComposerInput | null}

export type Composer = {
  getText: () => string
  getSelection: () => Selection | undefined
  isFocused: () => boolean
  focus: () => void
  // Replaces the whole text with the caret at its end. While no input is attached the latest
  // text waits and lands when one attaches, without the focus.
  inject: (text: string, focus?: boolean) => void
  // appendSpaceToText is the desktop emoji picker's placement: its space goes at the very end of
  // the text rather than after the insert, and the caret lands one past the insert
  insertAtCaret: (s: string, opts?: {appendSpaceToText?: boolean}) => void
  replace: (info: TextInfo, reflectChange: boolean) => void
  // Clears the input now and hands the text to send on the next tick; false when there is
  // nothing to send.
  submit: (send: (text: string, unfurlSuppress: SuppressSnapshot) => void) => boolean
  // An input's text belongs to the input it came from: attaching a different input starts over
  // with no text and a draft still to load. Re-attaching the same one (StrictMode's effect replay)
  // keeps both.
  attach: (input: ComposerInputRef, draft: string | undefined) => () => void
  // Loads the draft into an untouched composer, once per input.
  offerDraft: (draft: string | undefined) => void
  // What the input reports as typed. Reports from an input other than the attached one are dropped.
  textChanged: (input: ComposerInputRef, text: string) => void
}

type ComposerDeps = {
  // Taken before the clear, which runs onChangeText('') synchronously and drops every dismissal.
  // Urls whose preview has not landed yet are not in it and so are not suppressed.
  takeUnfurlSnapshot: () => SuppressSnapshot
}

const spoiler = '!>spoiler<!'
const injectedSelection = (text: string): Selection =>
  text === spoiler
    ? {end: text.length - 2, start: text.length - 2 - 7}
    : {end: text.length, start: text.length}

export const makeComposer = (deps: ComposerDeps): Composer => {
  let text = ''
  let session: ComposerInputRef | undefined
  let attached = false
  let draftLoaded = false
  let pending: string | undefined

  const current = () => (attached ? (session?.current ?? undefined) : undefined)

  const write = (next: string, focus: boolean) => {
    const input = current()
    if (!input) {
      // An edit prefill dropped here looks like edit mode never opened.
      logger.error('[chat] injectText dropped: input ref is null')
      return
    }
    text = next
    if (next) {
      input.replaceText({selection: injectedSelection(next), text: next}, true)
    } else {
      input.clear()
    }
    if (focus) {
      input.focus()
    }
  }

  const replace = (info: TextInfo, reflectChange: boolean) => {
    const input = current()
    if (!input) return
    text = info.text
    input.replaceText(info, reflectChange)
  }

  const offerDraft = (draft: string | undefined) => {
    if (draftLoaded || draft === undefined) return
    draftLoaded = true
    if (text === '' && draft) {
      write(draft, false)
    }
  }

  return {
    attach: (input, draft) => {
      if (session !== input) {
        session = input
        text = ''
        draftLoaded = false
      }
      attached = true
      offerDraft(draft)
      if (pending !== undefined) {
        const next = pending
        pending = undefined
        write(next, false)
      }
      return () => {
        if (session === input) {
          attached = false
        }
      }
    },
    focus: () => {
      current()?.focus()
    },
    getSelection: () => current()?.getSelection(),
    getText: () => text,
    inject: (next, focus = false) => {
      if (!attached) {
        pending = next
        return
      }
      write(next, focus)
    },
    insertAtCaret: (s, opts) => {
      const selection = current()?.getSelection()
      const start = selection?.start || 0
      const end = selection?.end || 0
      const pad = opts?.appendSpaceToText ? ' ' : ''
      const caret = start + s.length + pad.length
      replace({selection: {end: caret, start: caret}, text: text.slice(0, start) + s + text.slice(end) + pad}, true)
    },
    isFocused: () => !!current()?.isFocused(),
    offerDraft,
    replace,
    submit: send => {
      const toSend = text
      if (!toSend) return false
      const unfurlSuppress = deps.takeUnfurlSnapshot()
      write('', true)
      // Clearing the composer shrinks it back to one line, which grows the thread's viewport. Sending in
      // the same tick makes that growth and the new row a single change for the list to resolve its end
      // against, and it lands short — 8 of 8 at one, two and six lines, worse the longer the message. So
      // clear first and let that land before the row arrives. legend-list's own chat example does both at
      // once, which works there because its composer is a single-line input that never resizes the list.
      //
      // A timeout rather than requestAnimationFrame: this closure owns the only copy of the text, and
      // frames stop in a hidden or backgrounded window, which would drop the message with the composer
      // already emptied.
      setTimeout(() => {
        send(toSend, unfurlSuppress)
      }, 0)
      return true
    },
    textChanged: (input, next) => {
      if (input === session) {
        text = next
      }
    },
  }
}

export const ComposerContext = React.createContext<Composer | undefined>(undefined)
ComposerContext.displayName = 'ComposerContext'

export const useComposer = (): Composer => {
  const composer = React.useContext(ComposerContext)
  if (!composer) {
    throw new Error('Missing ConversationInputProvider in the tree')
  }
  return composer
}

// Binds one mounted platform input to the conversation's composer: attaches it (loading the draft
// the first time), detaches on unmount, and gives back the reporter for what the input says was typed.
export const useComposerInput = <R extends ComposerInput>(draft: string | undefined) => {
  const composer = useComposer()
  const inputRef = React.useRef<R | null>(null)
  const attach = React.useEffectEvent(() => composer.attach(inputRef, draft))
  React.useEffect(() => attach(), [composer])
  React.useEffect(() => {
    composer.offerDraft(draft)
  }, [composer, draft])
  const textChanged = (text: string) => {
    composer.textChanged(inputRef, text)
  }
  return {composer, inputRef, textChanged}
}
