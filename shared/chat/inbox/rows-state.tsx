import * as React from 'react'
import * as T from '@/constants/types'
import {useShallow} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {
  getBigLayoutChannelRow,
  getSmallLayoutRow,
  useInboxLayoutState,
  type BigLayoutChannelRow,
  type SmallLayoutRow,
} from '@/chat/inbox/layout-state'
import {useInboxBadgeState, type BadgeCounts} from '@/chat/inbox/badge-state'
import {useInboxTypingState} from '@/chat/inbox/typing-state'

export type InboxRowBig = {
  badgeCount: number
  channelname: string
  hasBadge: boolean
  hasDraft: boolean
  hasUnread: boolean
  isError: boolean
  isMuted: boolean
  snippet: string
  snippetDecoration: number
  teamname: string
  trustedState: T.Chat.MetaTrustedState
  unreadCount: number
}

export type InboxRowSmall = {
  badgeCount: number
  draft: string
  hasBadge: boolean
  hasResetUsers: boolean
  hasUnread: boolean
  isDecryptingSnippet: boolean
  isLocked: boolean
  isMuted: boolean
  participantNeedToRekey: boolean
  participants: ReadonlyArray<string>
  snippet: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  teamDisplayName: string
  timestamp: number
  trustedState: T.Chat.MetaTrustedState
  typingSnippet: string
  unreadCount: number
  youAreReset: boolean
  youNeedToRekey: boolean
}

type Meta = T.Immutable<T.Chat.ConversationMeta> | undefined
type ParticipantInfo = T.Immutable<T.Chat.ParticipantInfo> | undefined

// The row computations read a subset of meta. Subscribing to just these fields (not
// the meta object, whose identity changes on every version bump / send) lets visible
// rows bail unless something they show actually changed.
type SmallRowMeta =
  | Pick<
      NonNullable<Meta>,
      | 'draft'
      | 'isMuted'
      | 'membershipType'
      | 'rekeyers'
      | 'resetParticipants'
      | 'snippet'
      | 'snippetDecorated'
      | 'snippetDecoration'
      | 'teamname'
      | 'timestamp'
      | 'trustedState'
      | 'wasFinalizedBy'
    >
  | undefined
type BigRowMeta =
  | Pick<
      NonNullable<Meta>,
      | 'channelname'
      | 'draft'
      | 'isMuted'
      | 'snippet'
      | 'snippetDecorated'
      | 'snippetDecoration'
      | 'teamname'
      | 'trustedState'
    >
  | undefined

const buildTypingSnippet = (typing?: ReadonlySet<string>): string => {
  if (!typing?.size) {
    return ''
  }
  if (typing.size === 1) {
    const [t] = typing
    return `${t} is typing...`
  }
  return 'Multiple people typing...'
}

const bigSnippetDecoration = (sd: T.RPCChat.SnippetDecoration): number => {
  switch (sd) {
    case T.RPCChat.SnippetDecoration.pendingMessage:
    case T.RPCChat.SnippetDecoration.failedPendingMessage:
      return sd
    default:
      return 0
  }
}

const filterParticipants = (names: ReadonlyArray<string>, you: string): Array<string> =>
  names.length ? names.filter((pp, _i, list) => list.length === 1 || pp !== you) : []

const isMetaTrusted = (trustedState: T.Chat.MetaTrustedState) =>
  trustedState === 'trusted' || trustedState === 'error'

const computeSmallRow = (
  id: string,
  you: string,
  meta: SmallRowMeta,
  participantInfo: ParticipantInfo,
  layoutRow: SmallLayoutRow | undefined,
  counts: BadgeCounts | undefined,
  typing: ReadonlySet<string> | undefined
): InboxRowSmall => {
  const trustedState: T.Chat.MetaTrustedState = meta?.trustedState ?? 'untrusted'
  const metaTrusted = isMetaTrusted(trustedState)
  const badgeCount = counts?.badgeCount ?? 0
  const unreadCount = counts?.unreadCount ?? 0

  const metaSnippet = meta ? (meta.snippetDecorated ?? meta.snippet ?? '') : ''
  // ONE precedence rule: meta wins when trusted/error; otherwise the layout row
  // fills the gaps (snippet, draft, time, isMuted, name-split participants).
  const useLayout = !metaTrusted && !!layoutRow

  const snippet = useLayout ? (layoutRow.snippet ?? '') : metaSnippet
  const snippetDecoration = useLayout
    ? layoutRow.snippetDecoration
    : (meta?.snippetDecoration ?? T.RPCChat.SnippetDecoration.none)
  const draft = (useLayout ? layoutRow.draft : meta?.draft) || ''
  const timestamp = (useLayout ? layoutRow.time : meta?.timestamp) || 0
  const isMuted = useLayout ? layoutRow.isMuted : (meta?.isMuted ?? false)
  const teamDisplayName = useLayout
    ? layoutRow.isTeam
      ? (layoutRow.name.split('#')[0] ?? '')
      : ''
    : meta?.teamname
      ? (meta.teamname.split('#')[0] ?? '')
      : ''

  let participants = filterParticipants(participantInfo?.name ?? [], you)
  if (participants.length === 0 && layoutRow && !layoutRow.isTeam && layoutRow.name) {
    const names = layoutRow.name
      .split(',')
      .map(n => n.trim())
      .filter(Boolean)
    participants = filterParticipants(names, you)
  }

  const rekeyersSize = meta?.rekeyers.size ?? 0
  return {
    badgeCount,
    draft,
    hasBadge: badgeCount > 0,
    hasResetUsers: (meta?.resetParticipants.size ?? 0) > 0,
    hasUnread: unreadCount > 0,
    isDecryptingSnippet: !!id && !snippet && !metaTrusted,
    isLocked: rekeyersSize > 0 || !!meta?.wasFinalizedBy,
    isMuted,
    participantNeedToRekey: rekeyersSize > 0,
    participants,
    snippet,
    snippetDecoration,
    teamDisplayName,
    timestamp,
    trustedState,
    typingSnippet: buildTypingSnippet(typing),
    unreadCount,
    youAreReset: meta?.membershipType === 'youAreReset',
    youNeedToRekey: !!meta && meta.rekeyers.has(you),
  }
}

const computeBigRow = (
  meta: BigRowMeta,
  layoutChannel: BigLayoutChannelRow | undefined,
  counts: BadgeCounts | undefined
): InboxRowBig => {
  const trustedState: T.Chat.MetaTrustedState = meta?.trustedState ?? 'untrusted'
  const metaTrusted = isMetaTrusted(trustedState)
  const badgeCount = counts?.badgeCount ?? 0
  const unreadCount = counts?.unreadCount ?? 0
  const useLayout = !metaTrusted && !!layoutChannel
  const metaSnippet = meta ? (meta.snippetDecorated ?? meta.snippet ?? '') : ''
  return {
    badgeCount,
    channelname: useLayout ? layoutChannel.channelname : (meta?.channelname ?? ''),
    hasBadge: badgeCount > 0,
    hasDraft: useLayout ? !!layoutChannel.draft : !!meta?.draft,
    hasUnread: unreadCount > 0,
    isError: trustedState === 'error',
    isMuted: useLayout ? layoutChannel.isMuted : (meta?.isMuted ?? false),
    snippet: metaSnippet,
    snippetDecoration: bigSnippetDecoration(meta?.snippetDecoration ?? T.RPCChat.SnippetDecoration.none),
    teamname: useLayout ? layoutChannel.teamname : (meta?.teamname ?? ''),
    trustedState,
    unreadCount,
  }
}

export const useInboxRowSmall = (id: string): InboxRowSmall => {
  const you = useCurrentUserState(s => s.username)
  const meta = useInboxMetadataState(
    useShallow((s): SmallRowMeta => {
      const m = s.metas.get(id)
      return (
        m && {
          draft: m.draft,
          isMuted: m.isMuted,
          membershipType: m.membershipType,
          rekeyers: m.rekeyers,
          resetParticipants: m.resetParticipants,
          snippet: m.snippet,
          snippetDecorated: m.snippetDecorated,
          snippetDecoration: m.snippetDecoration,
          teamname: m.teamname,
          timestamp: m.timestamp,
          trustedState: m.trustedState,
          wasFinalizedBy: m.wasFinalizedBy,
        }
      )
    })
  )
  const participantInfo = useInboxMetadataState(s => s.participants.get(id))
  const layoutRow = useInboxLayoutState(s => getSmallLayoutRow(s, id))
  const counts = useInboxBadgeState(s => s.counts.get(id))
  const typing = useInboxTypingState(s => s.typing.get(id))
  return React.useMemo(
    () => computeSmallRow(id, you, meta, participantInfo, layoutRow, counts, typing),
    [id, you, meta, participantInfo, layoutRow, counts, typing]
  )
}

// Narrow muted read for callers (swipe actions) that don't need the full row —
// three primitive subscriptions instead of the six-slice computeSmallRow.
export const useInboxRowIsMuted = (id: string): boolean => {
  const metaIsMuted = useInboxMetadataState(s => s.metas.get(id)?.isMuted ?? false)
  const metaTrusted = useInboxMetadataState(s =>
    isMetaTrusted(s.metas.get(id)?.trustedState ?? 'untrusted')
  )
  const layoutIsMuted = useInboxLayoutState(s => getSmallLayoutRow(s, id)?.isMuted)
  return !metaTrusted && layoutIsMuted !== undefined ? layoutIsMuted : metaIsMuted
}

export const useInboxRowBig = (id: string): InboxRowBig => {
  const meta = useInboxMetadataState(
    useShallow((s): BigRowMeta => {
      const m = s.metas.get(id)
      return (
        m && {
          channelname: m.channelname,
          draft: m.draft,
          isMuted: m.isMuted,
          snippet: m.snippet,
          snippetDecorated: m.snippetDecorated,
          snippetDecoration: m.snippetDecoration,
          teamname: m.teamname,
          trustedState: m.trustedState,
        }
      )
    })
  )
  const layoutChannel = useInboxLayoutState(s => getBigLayoutChannelRow(s, id))
  const counts = useInboxBadgeState(s => s.counts.get(id))
  return React.useMemo(() => computeBigRow(meta, layoutChannel, counts), [meta, layoutChannel, counts])
}
