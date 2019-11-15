import * as Types from '../../../constants/types/teams'
import {getOrderedMemberArray, sortInvites} from './helpers'

type HeaderRow = {key: string; type: 'header'}
type TabsRow = {key: string; type: 'tabs'}
type MemberRow = {key: string; username: string; type: 'member'}
type InviteRow =
  | {key: string; label: string; type: 'invites-divider'}
  | {key: string; username: string; type: 'invites-request'}
  | {key: string; id: string; type: 'invites-invite'}
  | {key: string; type: 'invites-none'}
type SubteamRow =
  | {key: string; type: 'subteam-intro'}
  | {key: string; type: 'subteam-add'}
  | {key: string; teamID: Types.TeamID; type: 'subteam-subteam'}
  | {key: string; type: 'subteam-none'}
type SettingsRow = {key: string; type: 'settings'}
type LoadingRow = {key: string; type: 'loading'}
export type Row = HeaderRow | TabsRow | MemberRow | InviteRow | SubteamRow | SettingsRow | LoadingRow

const makeRows = (
  details: Types.TeamDetails,
  selectedTab: Types.TabKey,
  yourUsername: string,
  yourOperations: Types.TeamOperations
): Array<Row> => {
  const rows: Array<Row> = []
  switch (selectedTab) {
    case 'members':
      rows.push(
        ...getOrderedMemberArray(details.members, yourUsername, yourOperations).map(user => ({
          key: `member:${user.username}`,
          type: 'member' as const,
          username: user.username,
        }))
      )
      if (details.memberCount > 0 && !details.members) {
        // loading
        rows.push({key: 'loading', type: 'loading'})
      }
      break
    case 'invites': {
      const {invites, requests} = details
      let empty = true
      if (requests && requests.size) {
        empty = false
        rows.push({key: 'invites-divider:requests', label: 'Requests', type: 'invites-divider'})
        rows.push(
          ...[...requests].sort().map(username => ({
            key: `invites-request:${username}`,
            type: 'invites-request' as const,
            username,
          }))
        )
      }
      if (invites && invites.size) {
        empty = false
        rows.push({key: 'invites-divider:invites', label: 'Invites', type: 'invites-divider'})
        rows.push(
          ...[...invites]
            .sort(sortInvites)
            .map(i => ({id: i.id, key: `invites-invite:${i.id}`, type: 'invites-invite' as const}))
        )
      }
      if (empty) {
        rows.push({key: 'invites-none', type: 'invites-none'})
      }
      break
    }
    case 'subteams': {
      const {subteams} = details
      // always push subteam intro, it can decide not to render if already seen
      rows.push({key: 'subteam-intro', type: 'subteam-intro'})
      if (yourOperations.manageSubteams) {
        rows.push({key: 'subteam-add', type: 'subteam-add'})
      }
      if (subteams && subteams.size) {
        rows.push(
          ...[...subteams]
            .sort()
            .map(teamID => ({key: `subteam-subteam:${teamID}`, teamID, type: 'subteam-subteam' as const}))
        )
      } else {
        rows.push({key: 'subteam-none', type: 'subteam-none'})
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
