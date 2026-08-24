import * as React from 'react'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'

type State = T.Immutable<{
  dismissed: Map<T.Chat.ConversationIDKey, Set<string>>
  dispatch: {
    dismiss: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    keepOnly: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    remove: (conversationIDKey: T.Chat.ConversationIDKey, urls: ReadonlyArray<string>) => void
    resetState: () => void
  }
}>

export const useUnfurlPreviewState = Z.createZustand<State>('unfurl-preview', set => ({
  dismissed: new Map(),
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

export const getSuppressedURLs = (conversationIDKey: T.Chat.ConversationIDKey) => [
  ...(useUnfurlPreviewState.getState().dismissed.get(conversationIDKey) ?? []),
]

// dropped once the send they belong to lands; a targeted remove rather than a
// whole-conversation clear so a dismissal made while that send was in flight survives
export const removeSuppressedURLs = (
  conversationIDKey: T.Chat.ConversationIDKey,
  urls: ReadonlyArray<string>
) => {
  useUnfurlPreviewState.getState().dispatch.remove(conversationIDKey, urls)
}

// put back the snapshot a send took when that send never posted, so the composer the
// user gets back still has those urls dismissed
export const restoreSuppressedURLs = (
  conversationIDKey: T.Chat.ConversationIDKey,
  urls: ReadonlyArray<string>
) => {
  useUnfurlPreviewState.getState().dispatch.dismiss(conversationIDKey, urls)
}

const debounceMS = 500

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

export const useUnfurlPreviews = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  const [fetched, setFetched] = React.useState<ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>>([])
  const dismissedSet = useUnfurlPreviewState(s => s.dismissed.get(conversationIDKey))
  const {dismiss: dismissURL, keepOnly} = useUnfurlPreviewState(s => s.dispatch)
  const requestIDRef = React.useRef(0)
  // the input subtree remounts per conversation (key={conversationIDKey} on the provider),
  // so the first render of a conversation we return to always has empty text before the
  // draft is restored. clearing dismissals on that would throw away what the user
  // dismissed before switching away, so only prune once real text has been seen.
  const sawTextRef = React.useRef(false)
  const hasLink = text.includes('http')

  const onFetched = React.useCallback(
    (fetchedConversationIDKey: T.Chat.ConversationIDKey, infos: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>) => {
      setFetched(infos)
      keepOnly(
        fetchedConversationIDKey,
        infos.map(i => i.url)
      )
    },
    [keepOnly]
  )

  React.useEffect(() => {
    const id = ++requestIDRef.current
    if (!text.includes('http')) {
      if (sawTextRef.current) {
        keepOnly(conversationIDKey, [])
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
  }, [conversationIDKey, keepOnly, text, onFetched])

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
  const visible = React.useMemo(
    () => (hasLink ? fetched.filter(p => text.includes(p.url) && !dismissedSet?.has(p.url)) : []),
    [hasLink, fetched, text, dismissedSet]
  )
  return {dismiss, previews: visible}
}
