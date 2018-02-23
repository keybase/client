// @flow
import * as Types from '../../constants/types/teams'
type HeaderRow = {
  type: 'header',
  teamname: Types.Teamname,
}

type TabsRow = {
  type: 'tabs',
  admin: boolean,
  memberCount: number,
  teamname: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Types.TabKey) => void,
  yourOperations: Types.TeamOperations,
}

/* Member row */
type MemberRow = {
  type: 'member',
  active: boolean,
  fullName: string,
  username: string,
  teamname: string,
}

/* Subteams rows */
type SubteamIntroRow = {
  type: 'subteam',
  subtype: 'intro',
  key: 'intro',
  onHideSubteamsBanner: () => void,
  onReadMore: () => void,
  teamname: Types.Teamname,
}

type SubteamAddRow = {
  type: 'subteam',
  subtype: 'addSubteam',
  key: 'addSubteam',
  onCreateSubteam: () => void,
}

type SubteamTeamRow = {
  type: 'subteam',
  subtype: 'subteam',
  key: Types.Teamname,
  teamname: Types.Teamname,
}

type SubteamNoRow = {
  type: 'subteam',
  subtype: 'noSubteams',
  key: 'noSubteams',
}

type SubteamRow = SubteamIntroRow | SubteamAddRow | SubteamTeamRow | SubteamNoRow

type InvitesRow = {
  type: 'invites',
  teamname: Types.Teamname,
}

type SettingsRow = {
  type: 'settings',
  teamname: Types.Teamname,
}

type TeamRow = HeaderRow | TabsRow | MemberRow | SubteamRow | InvitesRow | SettingsRow

type TeamRows = Array<TeamRow>

export type {HeaderRow, TabsRow, MemberRow, SubteamRow, InvitesRow, SettingsRow, TeamRow, TeamRows}
