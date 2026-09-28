import * as React from 'react'
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
// One mounted composer view: the conversation's composer reads and writes through the input of
// the view that last attached one.
export type ComposerView = {
  // The input's callback ref: an element attaches it, null detaches it, both in the commit that
  // sets the ref, so no write can find the composer holding an input that is gone.
  setInput: (input: ComposerInput | null) => void
  // Loads the draft into an untouched composer, once per view, once the view's input is attached.
  offerDraft: (draft: string | undefined) => void
  // What the input reports, and whether the user typed it: false for the composer's own writes
  // (a draft, an inject, a clear), and for reports from a view other than the attached one, which
  // are dropped.
  textChanged: (text: string) => boolean
}

export type Composer = {
  getText: () => string
  getSelection: () => Selection | undefined
  isFocused: () => boolean
  focus: () => void
  // Replaces the whole text with the caret at its end.
  inject: (text: string, focus?: boolean) => void
  insertAtCaret: (s: string) => void
  // True when the input shows the text now; a write made while no input is attached waits.
  replace: (info: TextInfo, reflectChange: boolean) => boolean
  // Saves an empty draft and clears the input now (with none attached, the next one once it has
  // loaded its draft), and hands the text to send on the next tick; false when there is nothing to
  // send.
  submit: (send: (text: string, unfurlSuppress: SuppressSnapshot) => void) => boolean
  // An input's text belongs to the view it came from: an input attached by a different view starts
  // over with no text and a draft still to load. The same view attaching again (a new handle,
  // StrictMode's ref replay, a hidden Activity shown again) keeps both.
  // Writes made while no input is attached (an inject, an insert, a replace) wait, and land in
  // order once one attaches, after its draft; a waiting inject lands without the focus. A replace
  // carries a whole text worked out from its view's text, so it lands only if the same view
  // attaches again; injects, inserts and a send's clear land on whichever input comes next.
  connect: () => ComposerView
}

type ComposerDeps = {
  // The composer saves the draft: what the user types, and what it writes when that changes the
  // saved draft. saveDraft is throttled; flushDraft saves a pending one now.
  flushDraft: () => void
  saveDraft: (text: string) => void
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
  // the view whose input the composer reads and writes, and that input while it is attached
  let session: object | undefined
  let input: ComposerInput | null = null
  let draftLoaded = false
  // Effects mount children first (and again when a hidden Activity is shown), so a child's
  // write can come before its composer view attaches the input.
  let pending: Array<(input: ComposerInput) => void> = []
  // set while the composer writes, so the input's report of that write is not taken as typing
  let writing = false
  // the draft as last loaded or saved
  let saved: string | undefined

  const saveDraft = (next: string) => {
    if (next === saved) return
    saved = next
    deps.saveDraft(next)
  }

  const write = (target: ComposerInput, next: string, focus: boolean) => {
    text = next
    writing = true
    try {
      if (next) {
        target.replaceText({selection: injectedSelection(next), text: next}, true)
      } else {
        target.clear()
      }
    } finally {
      writing = false
    }
    saveDraft(text)
    if (focus) {
      target.focus()
    }
  }

  const whenAttached = (w: (input: ComposerInput) => void) => {
    if (input) {
      w(input)
    } else {
      pending.push(w)
    }
  }

  const replace = (target: ComposerInput, info: TextInfo, reflectChange: boolean) => {
    // the text is only ever what the input shows, or a send would send a preview nobody saw
    if (!target.replaceText(info, reflectChange)) return false
    text = info.text
    return true
  }

  // Loaded only once it is written, so an offer made before the view's input is attached is
  // retried when it attaches.
  const offerDraft = (draft: string | undefined) => {
    if (draftLoaded || draft === undefined) return
    if (text !== '' || !draft) {
      draftLoaded = true
      if (text === '') {
        saved = draft
      }
      return
    }
    if (!input) return
    draftLoaded = true
    saved = draft
    write(input, draft, false)
  }

  return {
    connect: () => {
      const view = {}
      let offered: string | undefined
      return {
        offerDraft: draft => {
          offered = draft
          if (session === view) {
            offerDraft(draft)
          }
        },
        setInput: next => {
          if (!next) {
            if (session === view) {
              input = null
              // what was typed is saved before whatever follows the input going away runs
              deps.flushDraft()
            }
            return
          }
          if (session !== view) {
            session = view
            text = ''
            draftLoaded = false
          }
          input = next
          offerDraft(offered)
          const waiting = pending
          pending = []
          waiting.forEach(whenAttached)
        },
        textChanged: next => {
          if (session !== view) return false
          text = next
          if (writing) return false
          saveDraft(next)
          return true
        },
      }
    },
    focus: () => {
      input?.focus()
    },
    getSelection: () => input?.getSelection(),
    getText: () => text,
    inject: (next, focus = false) => {
      if (input) {
        write(input, next, focus)
      } else {
        pending.push(target => write(target, next, false))
      }
    },
    insertAtCaret: s =>
      whenAttached(target => {
        const selection = target.getSelection()
        // the native input has no caret until it reports one
        const position = selection
          ? {end: selection.end ?? null, start: selection.start}
          : {end: text.length, start: text.length}
        const inserted = standardTransformer(s, {position, text}, true)
        replace(target, {selection: inserted.selection, text: inserted.text}, true)
      }),
    isFocused: () => !!input?.isFocused(),
    replace: (info, reflectChange) => {
      if (input) return replace(input, info, reflectChange)
      const from = session
      pending.push(target => {
        if (session === from) {
          replace(target, info, reflectChange)
        }
      })
      return false
    },
    submit: send => {
      const toSend = text
      if (!toSend) return false
      const unfurlSuppress = deps.takeUnfurlSnapshot()
      text = ''
      // The send owns the draft: it is emptied now, with or without an input, so no later flush
      // (a detach, the provider unmounting) can save the text being sent, and nothing depends on an
      // input attaching again.
      saveDraft('')
      deps.flushDraft()
      // with no input attached, the next one may still load the text being sent, if the row it
      // loads from was unboxed before the empty draft was saved
      if (input) {
        write(input, '', true)
      } else {
        pending.push(target => write(target, '', false))
      }
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

// Binds one mounted platform input to the conversation's composer, and gives back the input's
// ref setter (stable, so React never detaches and re-attaches the input between renders) and the
// reporter for what the input says was typed.
export const useComposerInput = <R extends ComposerInput>(draft: string | undefined) => {
  const composer = useComposer()
  const inputRef = React.useRef<R | null>(null)
  // read as the ref is set, so the draft loads ahead of the writes waiting for the input
  const currentDraft = React.useEffectEvent(() => draft)
  const [{setInput, view}] = React.useState(() => {
    const view = composer.connect()
    return {
      setInput: (input: R | null) => {
        inputRef.current = input
        if (input) {
          view.offerDraft(currentDraft())
        }
        view.setInput(input)
      },
      view,
    }
  })
  React.useEffect(() => {
    view.offerDraft(draft)
  }, [view, draft])
  return {composer, inputRef, setInput, textChanged: view.textChanged}
}
