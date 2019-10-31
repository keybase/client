import * as Types from '../../../constants/types/teams'
import {getOrderedMemberArray, sortInvites} from './helpers'

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

export type BodyRow = MemberRow | InviteRow | SubteamRow | SettingsRow
export type Row = HeaderRow | BodyRow

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
          type: 'member' as const,
          username: user.username,
        }))
      )
      break
    case 'invites': {
      const {invites, requests} = details
      let empty = true
      if (requests && requests.size) {
        empty = false
        rows.push({label: 'Requests', type: 'invites-divider'})
        rows.push(...[...requests].sort().map(username => ({type: 'invites-request' as const, username})))
      }
      if (invites && invites.size) {
        empty = false
        rows.push({label: 'Invites', type: 'invites-divider'})
        rows.push(...[...invites].sort(sortInvites).map(i => ({id: i.id, type: 'invites-invite' as const})))
      }
      if (empty) {
        rows.push({type: 'invites-none'})
      }
      break
    }
    case 'subteams': {
      const {subteams} = details
      // always push subteam intro, it can decide not to render if already seen
      rows.push({type: 'subteam-intro'})
      if (yourOperations.manageSubteams) {
        rows.push({type: 'subteam-add'})
      }
      if (subteams && subteams.size) {
        rows.push(...[...subteams].sort().map(teamID => ({teamID, type: 'subteam-subteam' as const})))
      } else {
        rows.push({type: 'subteam-none'})
      }
      break
    }
    case 'settings':
      rows.push({type: 'settings'})
      break
  }
  return rows
}

export default makeRows
