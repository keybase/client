import * as Types from '../../../constants/types/teams'
import {getOrderedMemberArray, sortInvites, getOrderedBotsArray} from './helpers'
import {isMobile} from '../../../constants/platform'
import flags from '../../../util/feature-flags'

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
  | {key: string; type: 'subteam-info'}
type SettingsRow = {key: string; type: 'settings'}
type LoadingRow = {key: string; type: 'loading'}
export type Row =
  | HeaderRow
  | DividerRow
  | TabsRow
  | MemberRow
  | BotRow
  | InviteRow
  | SubteamRow
  | SettingsRow
  | LoadingRow

const makeRows = (
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  selectedTab: Types.TabKey,
  yourUsername: string,
  yourOperations: Types.TeamOperations,
  invitesCollapsed: Set<Types.TeamID>,
  subteamsFiltered?: Set<Types.TeamID>
): Array<Row> => {
  const rows: Array<Row> = []
  switch (selectedTab) {
    case 'members':
      // For admins, 3 sections here
      // Requests (w/ header on mobile only)
      // Invites (w/ header)
      // Already in team (w/ header)
      if (yourOperations.manageMembers && flags.teamsRedesign) {
        if (details.requests?.size) {
          if (isMobile) {
            rows.push({
              count: details.requests.size,
              dividerType: 'requests',
              key: 'member-divider:requests',
              type: 'divider',
            })
          }
          rows.push(
            ...[...details.requests].sort().map(username => ({
              key: `invites-request:${username}`,
              type: 'invites-request' as const,
              username,
            }))
          )
        }
        if (details.invites?.size) {
          rows.push({
            count: details.invites.size,
            dividerType: 'invites',
            key: 'member-divider:invites',
            type: 'divider',
          })
          if (!invitesCollapsed.has(meta.id)) {
            rows.push(
              ...[...details.invites]
                .sort(sortInvites)
                .map(i => ({id: i.id, key: `invites-invite:${i.id}`, type: 'invites-invite' as const}))
            )
          }
        }
      }
      if (flags.teamsRedesign) {
        rows.push({
          count: meta.memberCount,
          dividerType: 'members',
          key: 'member-divider:members',
          type: 'divider',
        })
      }
      rows.push(
        ...getOrderedMemberArray(details.members, yourUsername, yourOperations).map(user => ({
          key: `member:${user.username}`,
          type: 'member' as const,
          username: user.username,
        }))
      )
      if (meta.memberCount > 0 && !details.members.size) {
        // loading
        rows.push({key: 'loading', type: 'loading'})
      }
      break
    case 'bots': {
      let bots = getOrderedBotsArray(details.members)
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
      if (flags.teamsRedesign) {
        const subteams = subteamsFiltered ?? details.subteams
        if (yourOperations.manageSubteams) {
          rows.push({key: 'subteam-add', type: 'subteam-add'})
        }
        if (subteams?.size) {
          rows.push(
            ...[...subteams]
              .sort()
              .map(teamID => ({key: `subteam-subteam:${teamID}`, teamID, type: 'subteam-subteam' as const}))
          )
        }
        rows.push({key: 'subteam-info', type: 'subteam-info'})
      } else {
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
