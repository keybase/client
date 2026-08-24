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
    // best-effort preview: an RPC failure just means no card shows, nothing for the user to act on
    logger.info('unfurl preview failed', e)
  }
}

type FetchedPreviews = {
  conversationIDKey: T.Chat.ConversationIDKey
  previews: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>
}

export const useUnfurlPreviews = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  const [fetched, setFetched] = React.useState<FetchedPreviews>({conversationIDKey, previews: []})
  const dismissedSet = useUnfurlPreviewState(s => s.dismissed.get(conversationIDKey))
  const {dismiss: dismissURL, keepOnly} = useUnfurlPreviewState(s => s.dispatch)
  const requestIDRef = React.useRef(0)
  const hasLink = text.includes('http')

  const onFetched = React.useCallback(
    (fetchedConversationIDKey: T.Chat.ConversationIDKey, infos: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo>) => {
      setFetched({conversationIDKey: fetchedConversationIDKey, previews: infos})
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
      keepOnly(conversationIDKey, [])
      return
    }
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

  // mask stale previews from a since-switched conversation the same way `hasLink` masks
  // text that no longer has a link, so a switch never flashes the previous conversation's card
  const visible = React.useMemo(
    () =>
      hasLink && fetched.conversationIDKey === conversationIDKey
        ? fetched.previews.filter(p => !dismissedSet?.has(p.url))
        : [],
    [hasLink, fetched, conversationIDKey, dismissedSet]
  )
  return {dismiss, previews: visible}
}
