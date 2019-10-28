import * as Types from '../../../constants/types/teams'

type HeaderRow = {type: 'header'} | {type: 'tabs'}

type MemberRow = {username: string; type: 'member'}

type InviteRow =
  | {label: string; type: 'invites-divider'}
  | {username: string; type: 'invites-request'}
  | {id: string; type: 'invites-invite'}
  | {type: 'invites-none'}

type SubteamRow =
  | {type: 'subteam-intro'}
  | {type: 'subteam-add'}
  | {teamID: Types.TeamID; type: 'subteam-subteam'}
  | {type: 'subteam-none'}

type SettingsRow = {type: 'settings'}

export type Row = HeaderRow | MemberRow | InviteRow | SubteamRow | SettingsRow

const makeRows = (): Array<Row> => []

export default makeRows
