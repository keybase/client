import {TabKey} from '../tabs'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as ChatConstants from '../../../constants/chat2'

type HeaderRow = {key: string; type: 'header'}
type DividerRow = {
  key: string
  count: number
  dividerType: 'members'
  type: 'divider'
}
type TabsRow = {key: string; type: 'tabs'}
type MemberRow = {key: string; username: string; type: 'member'}
type BotRow = {key: string; username: string; type: 'bot'} | {key: string; type: 'bot-add'}
type SettingsRow = {key: string; type: 'settings'}
type LoadingRow = {key: string; type: 'loading'}
export type Row = BotRow | DividerRow | HeaderRow | LoadingRow | MemberRow | SettingsRow | TabsRow

const makeRows = (
  selectedTab: TabKey,
  conversationIDKey: ChatTypes.ConversationIDKey,
  state: Container.TypedState
): Array<Row> => {
  const rows: Array<Row> = []
  switch (selectedTab) {
    case 'members': {
      const participantInfo = ChatConstants.getParticipantInfo(state, conversationIDKey)
      const participantItems = participantInfo.name
      rows.push({
        count: participantItems.length,
        dividerType: 'members',
        key: 'member-divider:members',
        type: 'divider',
      })
      rows.push(
        ...participantItems.map(username => ({
          key: `member:${username}`,
          type: 'member' as const,
          username: username,
        }))
      )
      break
    }
    case 'bots': {
      // TODO: load bot rows here.
      break
    }
    case 'settings':
      rows.push({key: 'settings', type: 'settings'})
      break
  }
  return rows
}

export default makeRows
