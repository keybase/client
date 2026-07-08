import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

// The inbox-metadata Zustand store plus its two lowest-level setters live here,
// with no dependency on '@/constants/router'. constants/router needs these at
// runtime (createConversation / previewConversation); keeping them router-free
// breaks the router <-> chat/inbox/metadata import cycle.

type InboxMetadataState = T.Immutable<{
  metas: Map<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  participants: Map<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
  dispatch: {
    resetState: () => void
  }
}>

export const useInboxMetadataState = Z.createZustand<InboxMetadataState>('inbox-metadata', () => ({
  dispatch: {resetState: Z.defaultReset},
  metas: new Map(),
  participants: new Map(),
}))

export const participantInfoReceived = (
  conversationIDKey: T.Chat.ConversationIDKey,
  participantInfo: T.Chat.ParticipantInfo
) => {
  useInboxMetadataState.setState(s => {
    s.participants.set(conversationIDKey, T.castDraft(participantInfo))
  })
}

export const metasReceived = (
  metas: ReadonlyArray<T.Chat.ConversationMeta>,
  removals?: ReadonlyArray<T.Chat.ConversationIDKey>,
  options?: {force?: boolean}
) => {
  const force = options?.force ?? false
  // Version-gate against the currently stored meta so a stale-version update
  // can't clobber newer data (previously done by the thread store). Compute
  // against getState() (not the immer draft) so updateMeta never sees a proxy.
  const current = useInboxMetadataState.getState().metas
  const nextMetas = metas.map(m => {
    const old = force ? undefined : current.get(m.conversationIDKey)
    return old ? Meta.updateMeta(old, m) : m
  })
  useInboxMetadataState.setState(s => {
    removals?.forEach(r => {
      s.metas.delete(r)
      s.participants.delete(r)
    })
    nextMetas.forEach(next => {
      s.metas.set(next.conversationIDKey, T.castDraft(next))
    })
  })
}
