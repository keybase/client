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
  // Inserts s at the caret the way typing does, so it lands in the platform's own undo history
  // and is reported through onChangeText. False when the input cannot.
  insertTyped: (s: string) => boolean
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
  // Loads the draft into an untouched composer, once per view, once the view's input is attached
  // and the user can post.
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
  // With no input attached, the next one to attach is focused if it comes within a second. One
  // focus waits at most: asking again only moves its deadline.
  focus: () => void
  // Replaces the whole text with the caret at its end.
  inject: (text: string, focus?: boolean) => void
  // Puts back text of the user's own that a send took out (a stellar send the user cancelled),
  // as inject does, and reports it so it is saved as the draft again. It lands even where the user
  // can't post: the text was theirs before the send.
  restore: (text: string) => void
  // Fills the composer with the text of the message to edit. Where the user can't post an edit
  // could never be sent, so it is refused (false) and the composer is left as it was.
  // An edit is not a draft: from here until the edit ends (a clear, or its send) nothing the
  // composer holds is saved, and the saved draft is set aside to come back when it ends.
  startEdit: (text: string) => boolean
  // Empties the composer. An edit ends instead, and the draft it set aside comes back (once the user
  // can post).
  clear: () => void
  insertAtCaret: (s: string) => void
  // Saves the text as the draft without it being typing: a suggestion preview the input shows
  // without reporting it, kept as the list closes.
  keepText: () => void
  // insertAtCaret, typed by the input itself where it can be, so the platform can undo it
  typeAtCaret: (s: string) => void
  // True when the input shows the text now; a write made while no input is attached waits.
  replace: (info: TextInfo, reflectChange: boolean) => boolean
  // Clears now and sends on the next tick; false when nothing is sent (no text, or the user can't
  // post, where the text and its draft stay). Sending an edit ends it as clear does.
  submit: (send: (text: string, unfurlSuppress: SuppressSnapshot) => void) => boolean
  // A different view attaching starts over (no text, its draft to load) unless an edit is on; the
  // same view attaching again (a new handle, StrictMode's ref replay, an Activity shown again)
  // keeps both. Writes made with no input attached land in order on the next one, after its draft,
  // except a replace: it was worked out from its view's text, so only that view gets it.
  connect: () => ComposerView
}

type ComposerDeps = {
  // The composer saves the draft: what the user types, and what it writes when that changes the
  // saved draft. saveDraft is throttled; flushDraft saves a pending one now.
  flushDraft: () => void
  // Where the user can't post, only a clear and a restore write, and only a restore saves the
  // draft. Read at every write from the store, which turns read-only before React renders it, so
  // no write in that commit (a ref being set, a child's effect) can come first.
  isReadOnly: () => boolean
  saveDraft: (text: string) => void
  // Taken before the clear, which runs onChangeText('') synchronously and drops every dismissal.
  // Urls whose preview has not landed yet are not in it and so are not suppressed.
  takeUnfurlSnapshot: () => SuppressSnapshot
}

const spoiler = '!>spoiler<!'
// long enough for an input on its way (a screen mounting, or shown again) to attach; one turning up
// later is not one the user just asked to focus
const focusWaitMs = 1000
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
  // set from the moment an edit's text lands until the edit ends
  let editing = false
  // when a focus asked for while no input was attached stops waiting
  let focusUntil: number | undefined

  // only a restore saves where the user can't post: it puts back the user's own text
  const saveDraft = (next: string, evenReadOnly = false) => {
    if (editing || next === saved || (!evenReadOnly && deps.isReadOnly())) return
    saved = next
    deps.saveDraft(next)
  }

  const asComposer = (w: () => void) => {
    writing = true
    try {
      w()
    } finally {
      writing = false
    }
  }

  // an input that does not show the text keeps the text it had
  const show = (target: ComposerInput, next: string) => {
    asComposer(() => {
      if (target.replaceText({selection: injectedSelection(next), text: next}, true)) {
        text = next
        saveDraft(next, true)
      }
    })
  }

  const write = (target: ComposerInput, next: string, focus: boolean) => {
    if (next) {
      if (!deps.isReadOnly()) {
        show(target, next)
      }
    } else {
      asComposer(() => {
        text = ''
        target.clear()
        saveDraft('')
      })
    }
    if (focus) {
      target.focus()
    }
  }

  // Ending an edit always takes its text out of the input. The draft it set aside comes back in its
  // place, but not where the user can't post: there the composer empties, and the draft loads again
  // once they can. Written while still editing, so it saves nothing: not even an empty draft over
  // one that has not loaded yet.
  const clear = (target: ComposerInput, focus: boolean) => {
    if (editing) {
      const readOnly = deps.isReadOnly()
      write(target, readOnly ? '' : (saved ?? ''), focus)
      if (readOnly) {
        draftLoaded = false
      }
      editing = false
    } else {
      write(target, '', focus)
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
    if (deps.isReadOnly() || !target.replaceText(info, reflectChange)) return false
    text = info.text
    return true
  }

  const insertAtCaret = (target: ComposerInput, s: string) => {
    const selection = target.getSelection()
    // the native input has no caret until it reports one
    const position = selection
      ? {end: selection.end ?? selection.start, start: selection.start}
      : {end: text.length, start: text.length}
    const inserted = standardTransformer(s, {position, text}, true)
    replace(target, {selection: inserted.selection, text: inserted.text}, true)
  }

  // Loaded only once it is written, so an offer made before the view's input is attached, or while
  // the user can't post, is retried by the next one (the input attaching or read-only clearing
  // makes one).
  const offerDraft = (draft: string | undefined) => {
    if (draftLoaded || draft === undefined) return
    if (editing) {
      draftLoaded = true
      saved = draft
      return
    }
    if (text !== '' || !draft) {
      draftLoaded = true
      if (text === '') {
        saved = draft
      }
      return
    }
    if (!input || deps.isReadOnly()) return
    draftLoaded = true
    saved = draft
    write(input, draft, false)
  }

  return {
    clear: () => {
      whenAttached(target => clear(target, false))
    },
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
          // an edit still on outlives the view that showed it, in memory only: it is never a draft
          const editText = session !== view && editing ? text : undefined
          if (session !== view) {
            session = view
            text = ''
            draftLoaded = false
          }
          input = next
          if (editText) {
            write(next, editText, false)
          }
          offerDraft(offered)
          const waiting = pending
          pending = []
          waiting.forEach(whenAttached)
          if (focusUntil !== undefined && Date.now() <= focusUntil) {
            next.focus()
          }
          focusUntil = undefined
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
      if (input) {
        input.focus()
      } else {
        focusUntil = Date.now() + focusWaitMs
      }
    },
    getSelection: () => input?.getSelection(),
    getText: () => text,
    inject: (next, focus = false) => {
      whenAttached(target => write(target, next, focus))
    },
    insertAtCaret: s => {
      whenAttached(target => insertAtCaret(target, s))
    },
    isFocused: () => !!input?.isFocused(),
    keepText: () => {
      saveDraft(text)
    },
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
    restore: next => {
      whenAttached(target => show(target, next))
    },
    startEdit: next => {
      if (deps.isReadOnly()) return false
      whenAttached(target => {
        editing = true
        write(target, next, false)
      })
      return true
    },
    submit: send => {
      const toSend = text
      if (!toSend || deps.isReadOnly()) return false
      const unfurlSuppress = deps.takeUnfurlSnapshot()
      text = ''
      // The send owns the draft: it is emptied now, with or without an input, so no later flush
      // (a detach, the provider unmounting) can save the text being sent, and nothing depends on an
      // input attaching again. An edit never saved its text, and leaves the draft as it was.
      saveDraft('')
      deps.flushDraft()
      // with no input attached, the next one may still load the text being sent, if the row it
      // loads from was unboxed before the empty draft was saved
      if (input) {
        clear(input, true)
      } else {
        pending.push(target => clear(target, false))
      }
      // The clear shrinks the composer, growing the thread's viewport; landing that in the same tick
      // as the new row leaves the list short of its end. A timeout, not a frame: frames stop in a
      // hidden window, and this closure holds the only copy of the text.
      setTimeout(() => {
        send(toSend, unfurlSuppress)
      }, 0)
      return true
    },
    typeAtCaret: s => {
      whenAttached(target => {
        if (!deps.isReadOnly() && !target.insertTyped(s)) {
          insertAtCaret(target, s)
        }
      })
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
export const useComposerInput = (draft: string | undefined, readOnly: boolean) => {
  const composer = useComposer()
  // The draft of the commit an input attaches in, offered as it attaches so it loads ahead of the
  // writes waiting for the input. The platform inputs are children, whose refs attach before any of
  // this view's layout effects run, so it is kept by an insertion effect, which runs before them all.
  const draftRef = React.useRef(draft)
  React.useInsertionEffect(() => {
    draftRef.current = draft
  }, [draft])
  const [{setInput, view}] = React.useState(() => {
    const view = composer.connect()
    return {
      setInput: (input: ComposerInput | null) => {
        if (input) view.offerDraft(draftRef.current)
        view.setInput(input)
      },
      view,
    }
  })
  // A draft that arrives after the input attached. The composer reads read-only itself; a change
  // only offers the draft again, which loads it once the user can post.
  React.useEffect(() => {
    view.offerDraft(draft)
  }, [view, draft, readOnly])
  return {composer, setInput, textChanged: view.textChanged}
}
