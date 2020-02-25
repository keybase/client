import {TabKey} from '../tabs'

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

const makeRows = (selectedTab: TabKey): Array<Row> => {
  const rows: Array<Row> = []
  switch (selectedTab) {
    case 'members':
      // TODO: load member rows here.
      break
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
