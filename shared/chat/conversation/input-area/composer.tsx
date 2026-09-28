import * as React from 'react'
import logger from '@/logger'
import type {SuppressSnapshot} from '../unfurl-preview-state'
import {standardTransformer} from './suggestors/common'
import type {Selection, TextInfo} from './normal/input.shared'

// The platform input the composer writes through: the desktop textarea, the native TextInput,
// or a fake in tests. The input keeps its own copy of the text for rendering; the composer is
// what everything else reads.
export type ComposerInput = {
  clear: () => void
  focus: () => void
  getSelection: () => Selection | undefined
  isFocused: () => boolean
  // reflectChange: echo the new text back through the input's onChangeText, as typing would.
  // False when the input did not show the text (the native input shows only reflected writes).
  replaceText: (info: TextInfo, reflectChange: boolean) => boolean
}
export type ComposerInputRef = {readonly current: ComposerInput | null}

export type Composer = {
  getText: () => string
  getSelection: () => Selection | undefined
  isFocused: () => boolean
  focus: () => void
  // Replaces the whole text with the caret at its end.
  inject: (text: string, focus?: boolean) => void
  // appendSpaceToText is the desktop emoji picker's placement: its space goes at the very end of
  // the text rather than after the insert, and the caret lands one past the insert
  insertAtCaret: (s: string, opts?: {appendSpaceToText?: boolean}) => void
  replace: (info: TextInfo, reflectChange: boolean) => void
  // Clears the input now (with none attached, the next one once it has loaded its draft) and
  // hands the text to send on the next tick; false when there is nothing to send.
  submit: (send: (text: string, unfurlSuppress: SuppressSnapshot) => void) => boolean
  // An input's text belongs to the input it came from: attaching a different input starts over
  // with no text and a draft still to load. Re-attaching the same one (StrictMode's effect replay)
  // keeps both.
  // Writes made while no input is attached (an inject, an insert, a replace) wait, and land in
  // order once one attaches, after its draft; a waiting inject lands without the focus.
  attach: (input: ComposerInputRef, draft: string | undefined) => () => void
  // Loads the draft into an untouched composer, once per input.
  offerDraft: (input: ComposerInputRef, draft: string | undefined) => void
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
  // Effects mount children first (and again when a hidden Activity is shown), so a child's
  // write can come before its composer view attaches the input.
  let pending: Array<() => void> = []

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

  const whenAttached = (w: () => void) => {
    if (attached) {
      w()
    } else {
      pending.push(w)
    }
  }

  const replace = (info: TextInfo, reflectChange: boolean) => {
    const input = current()
    if (!input) return
    // the text is only ever what the input shows, or a send would send a preview nobody saw
    if (input.replaceText(info, reflectChange)) {
      text = info.text
    }
  }

  // Loaded only once it is written, so an offer made while the input has no handle is retried
  // by the next one (the handle being set makes one).
  const offerDraft = (draft: string | undefined) => {
    if (draftLoaded || draft === undefined) return
    if (text !== '' || !draft) {
      draftLoaded = true
      return
    }
    if (!current()) return
    draftLoaded = true
    write(draft, false)
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
      const waiting = pending
      pending = []
      waiting.forEach(w => w())
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
      whenAttached(attached ? () => write(next, focus) : () => write(next, false))
    },
    insertAtCaret: (s, opts) =>
      whenAttached(() => {
        const selection = current()?.getSelection()
        const inserted = standardTransformer(
          s,
          {position: {end: selection?.end ?? null, start: selection?.start ?? null}, text},
          true
        )
        const pad = opts?.appendSpaceToText ? ' ' : ''
        const caret = inserted.selection.start + pad.length
        replace({selection: {end: caret, start: caret}, text: inserted.text + pad}, true)
      }),
    isFocused: () => !!current()?.isFocused(),
    offerDraft: (input, draft) => {
      if (input === session) {
        offerDraft(draft)
      }
    },
    replace: (info, reflectChange) => whenAttached(() => replace(info, reflectChange)),
    submit: send => {
      const toSend = text
      if (!toSend) return false
      const unfurlSuppress = deps.takeUnfurlSnapshot()
      text = ''
      // with no input attached, the next one loads the draft saved as this one unmounted, the
      // text being sent
      whenAttached(attached ? () => write('', true) : () => write('', false))
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
// the first time), detaches on unmount, and gives back the input's ref setter and the reporter for
// what the input says was typed.
export const useComposerInput = <R extends ComposerInput>(draft: string | undefined) => {
  const composer = useComposer()
  const inputRef = React.useRef<R | null>(null)
  const attach = React.useEffectEvent(() => composer.attach(inputRef, draft))
  React.useEffect(() => attach(), [composer])
  React.useEffect(() => {
    composer.offerDraft(inputRef, draft)
  }, [composer, draft])
  const textChanged = (text: string) => {
    composer.textChanged(inputRef, text)
  }
  // the input's ref: a draft offered before the handle was set loads once it is
  const setInput = (input: R | null) => {
    inputRef.current = input
    if (input) {
      composer.offerDraft(inputRef, draft)
    }
  }
  return {composer, inputRef, setInput, textChanged}
}
