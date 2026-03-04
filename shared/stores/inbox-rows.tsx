import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {getConvoState} from './convostate'
import {useCurrentUserState} from './current-user'
import {shallowEqual} from '@/constants/utils'

export type InboxRowBig = {
  channelname: string
  hasBadge: boolean
  hasDraft: boolean
  hasUnread: boolean
  isError: boolean
  isMuted: boolean
  snippetDecoration: number
}

export type InboxRowSmall = {
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
  typingSnippet: string
  youAreReset: boolean
  youNeedToRekey: boolean
}

const defaultInboxRowBig: InboxRowBig = {
  channelname: '', hasBadge: false, hasDraft: false, hasUnread: false,
  isError: false, isMuted: false, snippetDecoration: 0,
}

const defaultInboxRowSmall: InboxRowSmall = {
  draft: '', hasBadge: false, hasResetUsers: false, hasUnread: false,
  isDecryptingSnippet: true, isLocked: false, isMuted: false, participantNeedToRekey: false,
  participants: [], snippet: '', snippetDecoration: T.RPCChat.SnippetDecoration.none,
  teamDisplayName: '', timestamp: 0, typingSnippet: '', youAreReset: false, youNeedToRekey: false,
}

type State = T.Immutable<{
  rowsBig: Map<string, InboxRowBig>
  rowsSmall: Map<string, InboxRowSmall>
  dispatch: {
    resetState: 'default'
  }
}>

export const useInboxRowsState = Z.createZustand<State>('inboxRows', () => ({
  dispatch: {resetState: 'default'},
  rowsBig: new Map(),
  rowsSmall: new Map(),
}))

// Batched update queue
const pendingUpdates = new Set<string>()
let flushScheduled = false

export const queueInboxRowUpdate = (id: string) => {
  if (!id) return
  pendingUpdates.add(id)
  if (!flushScheduled) {
    flushScheduled = true
    setTimeout(flushInboxRowUpdates, 0)
  }
}

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

const flushInboxRowUpdates = () => {
  flushScheduled = false
  const ids = [...pendingUpdates]
  pendingUpdates.clear()
  if (!ids.length) return

  const you = useCurrentUserState.getState().username

  useInboxRowsState.setState(s => {
    for (const id of ids) {
      const cs = getConvoState(id)
      const m = cs.meta

      // Big — ensure entry exists
      if (!s.rowsBig.has(id)) {
        s.rowsBig.set(id, {...defaultInboxRowBig})
      }
      const big = s.rowsBig.get(id)!
      big.channelname = m.channelname
      big.hasBadge = cs.badge > 0
      big.hasDraft = !!m.draft
      big.hasUnread = cs.unread > 0
      big.isError = m.trustedState === 'error'
      big.isMuted = m.isMuted
      big.snippetDecoration = bigSnippetDecoration(m.snippetDecoration)

      // Small — ensure entry exists
      if (!s.rowsSmall.has(id)) {
        s.rowsSmall.set(id, {...defaultInboxRowSmall, participants: [] as string[]})
      }
      const small = s.rowsSmall.get(id)!
      const snippet = m.snippetDecorated ?? ''
      small.draft = m.draft || ''
      small.hasBadge = cs.badge > 0
      small.hasResetUsers = m.resetParticipants.size > 0
      small.hasUnread = cs.unread > 0
      small.isDecryptingSnippet = !!id && !snippet && (m.trustedState === 'requesting' || m.trustedState === 'untrusted')
      small.isLocked = m.rekeyers.size > 0 || !!m.wasFinalizedBy
      small.isMuted = m.isMuted
      small.participantNeedToRekey = m.rekeyers.size > 0
      const filtered = cs.participants.name.length
        ? cs.participants.name.filter((pp: string, _: number, list: readonly string[]) => list.length === 1 || pp !== you)
        : []
      if (!shallowEqual(small.participants as string[], filtered as string[])) {
        small.participants = filtered as string[]
      }
      small.snippet = snippet
      small.snippetDecoration = m.snippetDecoration
      small.teamDisplayName = m.teamname ? m.teamname.split('#')[0] ?? '' : ''
      small.timestamp = m.timestamp || 0
      small.typingSnippet = buildTypingSnippet(cs.typing)
      small.youAreReset = m.membershipType === 'youAreReset'
      small.youNeedToRekey = m.rekeyers.has(you)
    }
  })
}

export const useInboxRowBig = (id: string): InboxRowBig =>
  useInboxRowsState(s => s.rowsBig.get(id)) ?? defaultInboxRowBig

export const useInboxRowSmall = (id: string): InboxRowSmall =>
  useInboxRowsState(s => s.rowsSmall.get(id)) ?? defaultInboxRowSmall
