import type {ChatInboxRowItem} from './rowitem'
import * as T from '@/constants/types'

export type InboxRowsResult = {
  allowShowFloatingButton: boolean
  rows: Array<ChatInboxRowItem>
  smallTeamsExpanded: boolean
}

const emptyInboxRowsResult: InboxRowsResult = {
  allowShowFloatingButton: false,
  rows: [],
  smallTeamsExpanded: false,
}

// Build structural inbox rows from layout. Display data (badge, unread, muted, etc.)
// is read per-row via ChatProvider + useChatContext at render time.
export function buildInboxRows(
  layout: T.RPCChat.UIInboxLayout | undefined,
  inboxNumSmallRows: number,
  smallTeamsExpanded: boolean
): InboxRowsResult {
  if (!layout) return emptyInboxRowsResult

  const allSmallTeams = layout.smallTeams ?? []
  const bigTeams = layout.bigTeams ?? []
  const showAllSmallRows = smallTeamsExpanded || !bigTeams.length
  const visibleSmallTeams = showAllSmallRows ? allSmallTeams : allSmallTeams.slice(0, inboxNumSmallRows)

  const rows: Array<ChatInboxRowItem> = []

  for (const t of visibleSmallTeams) {
    const convId = T.Chat.stringToConversationIDKey(t.convID)
    rows.push({
      conversationIDKey: convId,
      type: 'small',
    })
  }

  const hasAllSmallTeamConvs = allSmallTeams.length === layout.totalSmallTeams
  const smallTeamsBelowTheFold = !showAllSmallRows && allSmallTeams.length > inboxNumSmallRows
  const showDivider = bigTeams.length > 0 || !hasAllSmallTeamConvs

  const hasSmall = visibleSmallTeams.length > 0
  const hasBig = bigTeams.length > 0

  if (hasSmall && !hasBig && !showDivider) {
    rows.push({type: 'teamBuilder'})
  }

  if (showDivider) {
    const dividerHiddenCount = Math.max(0, layout.totalSmallTeams - visibleSmallTeams.length)
    rows.push({
      hiddenCount: dividerHiddenCount,
      showButton: !hasAllSmallTeamConvs || smallTeamsBelowTheFold,
      type: 'divider',
    })
  }

  if (hasSmall && !hasBig && showDivider) {
    rows.push({type: 'teamBuilder'})
  }

  for (const t of bigTeams) {
    switch (t.state) {
      case T.RPCChat.UIInboxBigTeamRowTyp.channel: {
        const convId = T.Chat.stringToConversationIDKey(t.channel.convID)
        rows.push({
          conversationIDKey: convId,
          type: 'big',
        })
        break
      }
      case T.RPCChat.UIInboxBigTeamRowTyp.label:
        rows.push({
          teamID: t.label.id,
          teamname: t.label.name,
          type: 'bigHeader',
        })
        break
    }
  }

  if (hasSmall && hasBig) {
    rows.push({type: 'teamBuilder'})
  }

  const allowShowFloatingButton = allSmallTeams.length > inboxNumSmallRows && hasBig
  return {allowShowFloatingButton, rows, smallTeamsExpanded: showAllSmallRows}
}
