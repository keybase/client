// @flow
import * as Types from '../../constants/types/teams'
import typeof {navigateAppend, navigateUp} from '../../actions/route-tree'
type HeaderRow = {
  type: 'header',
  key: 'headerKey',
  teamname: Types.Teamname,
}

type TabsRow = {
  type: 'tabs',
  key: 'tabs',
  admin: boolean,
  memberCount: number,
  teamname: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  loading?: boolean,
  resetUserCount: number,
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
  key: string,
  roleType: Types.TeamRoleType,
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

/* Invites rows */
type Request = {
  type: 'invites',
  subtype: 'request',
  key: string,
  teamname: string,
  username: string,
}

type Invite = {
  type: 'invites',
  subtype: 'invite',
  email?: string,
  name?: string,
  key: string,
  id: string,
  username: string,
  teamname: string,
}

type Divider = {
  type: 'invites',
  subtype: 'divider',
  key: 'Invites' | 'Requests',
}

type NoRequestsOrInvites = {
  type: 'invites',
  subtype: 'none',
  key: 'noRequestsOrInvites',
}

type RequestsOrInvitesRow = Request | Invite | Divider | NoRequestsOrInvites

type SettingsRow = {
  type: 'settings',
  teamname: Types.Teamname,
  navigateUp: navigateUp,
  navigateAppend: navigateAppend,
}

type TeamRow = HeaderRow | TabsRow | MemberRow | SubteamRow | RequestsOrInvitesRow | SettingsRow

type TeamRows = Array<TeamRow>

export type {HeaderRow, TabsRow, MemberRow, SubteamRow, RequestsOrInvitesRow, SettingsRow, TeamRow, TeamRows}
