import * as Types from '../../../constants/types/teams'
import {getOrderedBotsArray} from '../../team/rows/helpers'

type HeaderRow = {key: string; type: 'header'}
type DividerRow = {
  key: string
  count: number
  dividerType: 'requests' | 'invites' | 'members'
  type: 'divider'
}
type TabsRow = {key: string; type: 'tabs'}
type MemberRow = {key: string; username: string; type: 'member'}
type BotRow = {key: string; username: string; type: 'bot'} | {key: string; type: 'bot-add'}
type SettingsRow = {key: string; type: 'settings'}
type LoadingRow = {key: string; type: 'loading'}
export type Row = BotRow | DividerRow | HeaderRow | LoadingRow | MemberRow | SettingsRow | TabsRow

const makeRows = (
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  selectedTab: Types.TabKey,
  yourOperations: Types.TeamOperations
): Array<Row> => {
  const rows: Array<Row> = []
  switch (selectedTab) {
    case 'members':
      if (meta.memberCount > 0 && !details.members.size) {
        // loading
        rows.push({key: 'loading', type: 'loading'})
      }
      break
    case 'bots': {
      const bots = getOrderedBotsArray(details.members)
      rows.push(
        ...bots.map(bot => ({
          key: `bot:${bot.username}`,
          type: 'bot' as const,
          username: bot.username,
        }))
      )
      if (meta.memberCount > 0 && !details.members) {
        // loading
        rows.push({key: 'loading', type: 'loading'})
      }
      if (yourOperations.manageBots) {
        rows.push({key: 'bot:install-more', type: 'bot-add'})
      }
      break
    }
    case 'settings':
      rows.push({key: 'settings', type: 'settings'})
      break
  }
  return rows
}

export default makeRows
