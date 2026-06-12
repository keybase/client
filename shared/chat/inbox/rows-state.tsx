import * as T from '@/constants/types'
import * as Common from '@/constants/chat/common'
import * as Z from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {shallowEqual} from '@/constants/utils'

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

const defaultInboxRowBig = {
  badgeCount: 0,
  channelname: '',
  hasBadge: false,
  hasDraft: false,
  hasUnread: false,
  isError: false,
  isMuted: false,
  snippet: '',
  snippetDecoration: 0,
  teamname: '',
  trustedState: 'untrusted',
  unreadCount: 0,
} satisfies InboxRowBig

const defaultInboxRowSmall: InboxRowSmall = {
  badgeCount: 0,
  draft: '',
  hasBadge: false,
  hasResetUsers: false,
  hasUnread: false,
  isDecryptingSnippet: true,
  isLocked: false,
  isMuted: false,
  participantNeedToRekey: false,
  participants: [],
  snippet: '',
  snippetDecoration: T.RPCChat.SnippetDecoration.none,
  teamDisplayName: '',
  timestamp: 0,
  trustedState: 'untrusted',
  typingSnippet: '',
  unreadCount: 0,
  youAreReset: false,
  youNeedToRekey: false,
}

type State = T.Immutable<{
  rowsBig: Map<string, InboxRowBig>
  rowsSmall: Map<string, InboxRowSmall>
  dispatch: {
    resetState: () => void
  }
}>

const ensureBigRow = (rowsBig: Map<string, InboxRowBig>, id: string) => {
  if (!rowsBig.has(id)) {
    rowsBig.set(id, {...defaultInboxRowBig})
  }
  return rowsBig.get(id)!
}

const ensureSmallRow = (rowsSmall: Map<string, InboxRowSmall>, id: string) => {
  if (!rowsSmall.has(id)) {
    rowsSmall.set(id, {...defaultInboxRowSmall, participants: [] as string[]})
  }
  return rowsSmall.get(id)!
}

export const useInboxRowsState = Z.createZustand<State>('inboxRows', () => ({
  dispatch: {resetState: Z.defaultReset},
  rowsBig: new Map(),
  rowsSmall: new Map(),
}))

const buildTypingSnippet = (typing: ReadonlySet<string>): string => {
  if (!typing.size) return ''
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

const applyParticipantsToSmallRow = (
  small: InboxRowSmall,
  participantInfo: T.Chat.ParticipantInfo,
  you: string
) => {
  const filtered = participantInfo.name.length
    ? participantInfo.name.filter((pp, _, list) => list.length === 1 || pp !== you)
    : []
  if (!shallowEqual(small.participants, filtered)) {
    small.participants = filtered
  }
}

const applyMetaToRows = (
  rowsBig: Map<string, InboxRowBig>,
  rowsSmall: Map<string, InboxRowSmall>,
  meta: T.Chat.ConversationMeta,
  you: string,
  participantInfo?: T.Chat.ParticipantInfo
) => {
  const id = meta.conversationIDKey
  const snippet = meta.snippetDecorated ?? meta.snippet ?? ''

  const big = ensureBigRow(rowsBig, id)
  big.channelname = meta.channelname
  big.hasBadge = big.badgeCount > 0
  big.hasDraft = !!meta.draft
  big.hasUnread = big.unreadCount > 0
  big.isError = meta.trustedState === 'error'
  big.isMuted = meta.isMuted
  big.snippet = snippet
  big.snippetDecoration = bigSnippetDecoration(meta.snippetDecoration)
  big.teamname = meta.teamname
  big.trustedState = meta.trustedState

  const small = ensureSmallRow(rowsSmall, id)
  small.draft = meta.draft || ''
  small.hasBadge = small.badgeCount > 0
  small.hasResetUsers = meta.resetParticipants.size > 0
  small.hasUnread = small.unreadCount > 0
  small.isDecryptingSnippet =
    !!id && !snippet && (meta.trustedState === 'requesting' || meta.trustedState === 'untrusted')
  small.isLocked = meta.rekeyers.size > 0 || !!meta.wasFinalizedBy
  small.isMuted = meta.isMuted
  small.participantNeedToRekey = meta.rekeyers.size > 0
  if (participantInfo) {
    applyParticipantsToSmallRow(small, participantInfo, you)
  }
  small.snippet = snippet
  small.snippetDecoration = meta.snippetDecoration
  small.teamDisplayName = meta.teamname ? meta.teamname.split('#')[0] ?? '' : ''
  small.timestamp = meta.timestamp || 0
  small.trustedState = meta.trustedState
  small.youAreReset = meta.membershipType === 'youAreReset'
  small.youNeedToRekey = meta.rekeyers.has(you)
}

export const syncInboxRowsFromMetaAndParticipants = (
  entries: ReadonlyArray<{
    meta: T.Chat.ConversationMeta
    participantInfo?: T.Chat.ParticipantInfo
  }>
) => {
  const you = useCurrentUserState.getState().username
  useInboxRowsState.setState(s => {
    entries.forEach(({meta, participantInfo}) => {
      applyMetaToRows(s.rowsBig, s.rowsSmall, meta, you, participantInfo)
    })
  })
}

export const syncInboxRowsFromMetas = (
  metas: ReadonlyArray<T.Chat.ConversationMeta>,
  removals?: ReadonlyArray<T.Chat.ConversationIDKey>
) => {
  const you = useCurrentUserState.getState().username
  useInboxRowsState.setState(s => {
    removals?.forEach(id => {
      s.rowsBig.delete(id)
      s.rowsSmall.delete(id)
    })
    metas.forEach(meta => {
      applyMetaToRows(s.rowsBig, s.rowsSmall, meta, you)
    })
  })
}

export const syncInboxRowsFromParticipants = (inboxUIItems: ReadonlyArray<T.RPCChat.InboxUIItem>) => {
  const you = useCurrentUserState.getState().username
  useInboxRowsState.setState(s => {
    inboxUIItems.forEach(inboxUIItem => {
      const participantInfo = Common.uiParticipantsToParticipantInfo(inboxUIItem.participants ?? [])
      if (participantInfo.all.length > 0) {
        const id = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
        applyParticipantsToSmallRow(ensureSmallRow(s.rowsSmall, id), participantInfo, you)
      }
    })
  })
}

export const syncInboxRowsFromParticipantMap = (
  participantMap?: {[key: string]: ReadonlyArray<T.RPCChat.UIParticipant> | null} | null
) => {
  const you = useCurrentUserState.getState().username
  useInboxRowsState.setState(s => {
    Object.keys(participantMap ?? {}).forEach(convIDStr => {
      const participants = participantMap?.[convIDStr]
      if (!participants) {
        return
      }
      const participantInfo = Common.uiParticipantsToParticipantInfo(participants)
      if (participantInfo.all.length > 0) {
        const id = T.Chat.stringToConversationIDKey(convIDStr)
        applyParticipantsToSmallRow(ensureSmallRow(s.rowsSmall, id), participantInfo, you)
      }
    })
  })
}

export const syncInboxRowsFromLayout = (layout: T.RPCChat.UIInboxLayout) => {
  const you = useCurrentUserState.getState().username
  useInboxRowsState.setState(s => {
    layout.smallTeams?.forEach(row => {
      const id = T.Chat.stringToConversationIDKey(row.convID)
      const small = ensureSmallRow(s.rowsSmall, id)
      const snippet = row.snippet ?? ''
      small.draft = row.draft || ''
      small.hasBadge = small.badgeCount > 0
      small.hasUnread = small.unreadCount > 0
      small.isDecryptingSnippet = !!id && !snippet && small.trustedState !== 'trusted'
      small.isMuted = row.isMuted
      small.snippet = snippet
      small.snippetDecoration = row.snippetDecoration
      small.teamDisplayName = row.isTeam ? row.name.split('#')[0] ?? '' : ''
      small.timestamp = row.time || 0
      if (!row.isTeam && row.name && small.participants.length === 0) {
        const names = row.name
          .split(',')
          .map(n => n.trim())
          .filter(Boolean)
        const participantInfo: T.Chat.ParticipantInfo = {all: names, contactName: new Map(), name: names}
        applyParticipantsToSmallRow(small, participantInfo, you)
      }

      const big = ensureBigRow(s.rowsBig, id)
      big.hasBadge = big.badgeCount > 0
      big.hasDraft = !!row.draft
      big.hasUnread = big.unreadCount > 0
      big.isMuted = row.isMuted
      big.snippet = snippet
      big.snippetDecoration = bigSnippetDecoration(row.snippetDecoration)
      big.teamname = row.isTeam ? row.name : ''
    })
    layout.bigTeams?.forEach(row => {
      if (row.state !== T.RPCChat.UIInboxBigTeamRowTyp.channel) {
        return
      }
      const id = T.Chat.stringToConversationIDKey(row.channel.convID)
      const big = ensureBigRow(s.rowsBig, id)
      big.channelname = row.channel.channelname
      big.hasBadge = big.badgeCount > 0
      big.hasDraft = !!row.channel.draft
      big.hasUnread = big.unreadCount > 0
      big.isMuted = row.channel.isMuted
      big.teamname = row.channel.teamname
    })
  })
}

export const getInboxRowTrustedState = (id: T.Chat.ConversationIDKey) => {
  const {rowsBig, rowsSmall} = useInboxRowsState.getState()
  return rowsSmall.get(id)?.trustedState ?? rowsBig.get(id)?.trustedState
}

export const setInboxRowTrustedState = (
  ids: ReadonlyArray<T.Chat.ConversationIDKey>,
  trustedState: T.Chat.MetaTrustedState
) => {
  useInboxRowsState.setState(s => {
    ids.forEach(id => {
      const small = ensureSmallRow(s.rowsSmall, id)
      small.trustedState = trustedState
      small.isDecryptingSnippet =
        !!id && !small.snippet && (trustedState === 'requesting' || trustedState === 'untrusted')

      const big = ensureBigRow(s.rowsBig, id)
      big.trustedState = trustedState
      big.isError = trustedState === 'error'
    })
  })
}

export const syncInboxRowBadgeState = (badgeState?: T.RPCGen.BadgeState) => {
  if (!badgeState) {
    return
  }
  const updated = new Set<string>()
  useInboxRowsState.setState(s => {
    badgeState.conversations?.forEach(conversation => {
      const id = T.Chat.conversationIDToKey(conversation.convID)
      updated.add(id)

      const big = ensureBigRow(s.rowsBig, id)
      big.badgeCount = conversation.badgeCount
      big.hasBadge = conversation.badgeCount > 0
      big.hasUnread = conversation.unreadMessages > 0
      big.unreadCount = conversation.unreadMessages

      const small = ensureSmallRow(s.rowsSmall, id)
      small.badgeCount = conversation.badgeCount
      small.hasBadge = conversation.badgeCount > 0
      small.hasUnread = conversation.unreadMessages > 0
      small.unreadCount = conversation.unreadMessages
    })

    for (const [id, big] of s.rowsBig) {
      if (updated.has(id)) continue
      big.badgeCount = 0
      big.hasBadge = false
      big.hasUnread = false
      big.unreadCount = 0
    }
    for (const [id, small] of s.rowsSmall) {
      if (updated.has(id)) continue
      small.badgeCount = 0
      small.hasBadge = false
      small.hasUnread = false
      small.unreadCount = 0
    }
  })
}

export const updateInboxRowTyping = (updates?: ReadonlyArray<T.RPCChat.ConvTypingUpdate> | null) => {
  useInboxRowsState.setState(s => {
    updates?.forEach(update => {
      const id = T.Chat.conversationIDToKey(update.convID)
      const typing = new Set(update.typers?.map(typer => typer.username))
      const small = ensureSmallRow(s.rowsSmall, id)
      small.typingSnippet = buildTypingSnippet(typing)
    })
  })
}

export const useInboxRowBig = (id: string): InboxRowBig =>
  useInboxRowsState(s => s.rowsBig.get(id)) ?? defaultInboxRowBig

export const useInboxRowSmall = (id: string): InboxRowSmall =>
  useInboxRowsState(s => s.rowsSmall.get(id)) ?? defaultInboxRowSmall
