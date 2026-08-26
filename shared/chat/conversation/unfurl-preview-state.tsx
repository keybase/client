import * as React from 'react'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'

type State = T.Immutable<{
  dismissed: Map<T.Chat.ConversationIDKey, Set<string>>
  // urls the service could not preview. they suppress on send like a dismissal does, but
  // are kept apart from one: the next fetch replaces this set wholesale, and a url that
  // starts scraping again must come back as a card, which it could not do if a failure
  // had been recorded as something the user dismissed, since nothing re-derives a dismissal
  failed: Map<T.Chat.ConversationIDKey, Set<string>>
  dispatch: {
    dismiss: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    keepOnly: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    remove: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    setFailed: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    resetState: () => void
  }
}>

export const useUnfurlPreviewState = Z.createZustand<State>('unfurl-preview', set => ({
  dismissed: new Map(),
  failed: new Map(),
  dispatch: {
    // also the restore path after a canceled send: both mean "these urls are suppressed"
    dismiss: (conversationIDKey, urls) => {
      if (!urls.length) return
      set(s => {
        const existing = s.dismissed.get(conversationIDKey) ?? new Set<string>()
        for (const url of urls) existing.add(url)
        s.dismissed.set(conversationIDKey, existing)
      })
    },
    keepOnly: (conversationIDKey, urls) => {
      set(s => {
        const existing = s.dismissed.get(conversationIDKey)
        if (!existing) return
        for (const url of [...existing]) {
          if (!urls.includes(url)) existing.delete(url)
        }
        if (!existing.size) s.dismissed.delete(conversationIDKey)
      })
    },
    setFailed: (conversationIDKey, urls) => {
      set(s => {
        if (!urls.length) {
          s.failed.delete(conversationIDKey)
          return
        }
        s.failed.set(conversationIDKey, new Set(urls))
      })
    },
    remove: (conversationIDKey, urls) => {
      set(s => {
        const existing = s.dismissed.get(conversationIDKey)
        if (!existing) return
        for (const url of urls) existing.delete(url)
        if (!existing.size) s.dismissed.delete(conversationIDKey)
      })
    },
    resetState: Z.defaultReset,
  },
}))

// the two suppression sources kept apart, because a send that never posts has to put the
// dismissals back without the failures: see the `failed` field above
export type SuppressSnapshot = T.Immutable<{dismissed: ReadonlyArray<string>; failed: ReadonlyArray<string>}>

export const takeSuppressSnapshot = (conversationIDKey: T.Chat.ConversationIDKey): SuppressSnapshot => {
  const {dismissed, failed} = useUnfurlPreviewState.getState()
  return {
    dismissed: [...(dismissed.get(conversationIDKey) ?? [])],
    failed: [...(failed.get(conversationIDKey) ?? [])],
  }
}

// the send suppresses both, so the message unfurls exactly the cards the composer offered
export const suppressedURLsOf = (snapshot: SuppressSnapshot) => [
  ...new Set([...snapshot.dismissed, ...snapshot.failed]),
]

// dropped once the send they belong to lands; a targeted remove rather than a
// whole-conversation clear so a dismissal made while that send was in flight survives
export const removeDismissals = (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => {
  useUnfurlPreviewState.getState().dispatch.remove(conversationIDKey, urls)
}

// put back what a send took when that send never posted, so the composer the user gets
// back still has those urls dismissed
export const restoreDismissals = (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => {
  useUnfurlPreviewState.getState().dispatch.dismiss(conversationIDKey, urls)
}

// a send during this window (paste a link, hit enter) suppresses nothing, so the message
// unfurls the url the way it always has: the composer only promises to show what will
// unfurl once its previews have landed. suppressing urls it has not heard about yet would
// mean a link sent quickly never unfurls at all, which is how most links go out
const debounceMS = 500

// what can follow a url and still end it. typing on past one makes the old url a prefix of
// the new one, and a plain substring test would keep the stale card alive and dismissable
// while the message carries a different link
const urlEnd = /[\s.,;:!?)\]}'"]/

const stillInText = (text: string, url: string) => {
  for (let from = text.indexOf(url); from >= 0; from = text.indexOf(url, from + 1)) {
    const after = text[from + url.length]
    if (after === undefined || urlEnd.test(after)) return true
  }
  return false
}

// kept outside the hook body: try/catch inside a hook trips the react-compiler bailout check
const fetchPreviews = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  text: string,
  requestID: number,
  requestIDRef: {current: number},
  onSuccess: (conversationIDKey: T.Chat.ConversationIDKey, infos: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>) => void
) => {
  try {
    const res = await T.RPCChat.localUnfurlPreviewLocalRpcPromise({
      convID: T.Chat.keyToConversationID(conversationIDKey),
      text,
    })
    if (requestID !== requestIDRef.current) return
    onSuccess(conversationIDKey, res ?? [])
  } catch (e) {
    // best-effort preview: nothing is shown for a url whose fetch failed, since `visible`
    // only surfaces previews whose url is still in the composer text
    logger.info('unfurl preview failed', e)
  }
}

// module-wide, so an id is never handed out twice. a per-mount counter would start over,
// and a mount is torn down and rebuilt without a fresh ref whenever a screen freezes, which
// would let a fetch left running by the old one match the new one's id
let nextRequestID = 0
// through a helper: the compiler bails out of a hook that updates a global in place
const takeRequestID = () => ++nextRequestID

export const useUnfurlPreviews = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  const [fetched, setFetched] = React.useState<ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>>([])
  const dismissedSet = useUnfurlPreviewState(s => s.dismissed.get(conversationIDKey))
  const {dismiss: dismissURL, keepOnly, setFailed} = useUnfurlPreviewState(s => s.dispatch)
  // the id of the only fetch whose result this mount will still take
  const requestIDRef = React.useRef(0)
  // the input subtree remounts per conversation (key={conversationIDKey} on the provider),
  // so the first render of a conversation we return to always has empty text before the
  // draft is restored. clearing dismissals on that would throw away what the user
  // dismissed before switching away, so only prune once real text has been seen.
  const sawTextRef = React.useRef(false)
  const hasLink = text.includes('http')

  // retires every fetch this mount left in flight, so one cannot write into the mount that
  // replaces it. 0 is not a request id, and ids are never reused, so nothing can match again
  React.useEffect(() => {
    // the alias is for the lint rule about reading a ref in cleanup: this ref holds a
    // request id, not a node, and retiring it is the whole point of the cleanup
    const requests = requestIDRef
    return () => {
      requests.current = 0
    }
  }, [])

  const onFetched = React.useCallback(
    (fetchedConversationIDKey: T.Chat.ConversationIDKey, infos: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>) => {
      setFetched(infos)
      keepOnly(
        fetchedConversationIDKey,
        infos.map(i => i.url)
      )
      setFailed(
        fetchedConversationIDKey,
        infos.filter(i => !i.unfurl).map(i => i.url)
      )
    },
    [keepOnly, setFailed]
  )

  React.useEffect(() => {
    const id = takeRequestID()
    requestIDRef.current = id
    if (!hasLink) {
      if (sawTextRef.current) {
        keepOnly(conversationIDKey, [])
        setFailed(conversationIDKey, [])
      }
      sawTextRef.current = sawTextRef.current || !!text
      return
    }
    sawTextRef.current = true
    const timeoutID = setTimeout(() => {
      ignorePromise(fetchPreviews(conversationIDKey, text, id, requestIDRef, onFetched))
    }, debounceMS)
    return () => {
      clearTimeout(timeoutID)
    }
  }, [conversationIDKey, hasLink, keepOnly, setFailed, text, onFetched])

  const dismiss = React.useCallback(
    (url: string) => {
      dismissURL(conversationIDKey, [url])
    },
    [conversationIDKey, dismissURL]
  )

  // a card is only shown while its url is still in the composer. the fetch that would
  // replace these previews can fail or still be in flight, and showing a card for a url the
  // user has since deleted is worse than showing nothing: its X would suppress a link that
  // is not in the message, while the link that is about to send never gets offered one.
  // no unfurl means the service could not preview it: nothing to show, nothing to dismiss
  const visible = React.useMemo(
    () =>
      hasLink
        ? fetched.flatMap(p =>
            p.unfurl && stillInText(text, p.url) && !dismissedSet?.has(p.url)
              ? [{unfurl: p.unfurl, url: p.url}]
              : []
          )
        : [],
    [hasLink, fetched, text, dismissedSet]
  )
  return {dismiss, previews: visible}
}
