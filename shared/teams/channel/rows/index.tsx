import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import {getOrderedMemberArray, sortInvites, getOrderedBotsArray} from '../../team/rows/helpers'
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
type SettingsRow = {key: string; type: 'settings'}
type LoadingRow = {key: string; type: 'loading'}
export type Row = BotRow | DividerRow | HeaderRow | LoadingRow | MemberRow | SettingsRow | TabsRow

const makeRows = (
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  selectedTab: Types.TabKey,
  yourUsername: string,
  yourOperations: Types.TeamOperations,
  invitesCollapsed: Set<Types.TeamID>,
  channelInfos?: Map<ChatTypes.ConversationIDKey, Types.ChannelInfo>,
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
            ...[...details.requests].map(req => {
              return {
                ctime: req.ctime,
                fullName: req.fullName,
                key: `invites-request:${req.username}`,
                type: 'invites-request' as const,
                username: req.username,
              }
            })
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
          ...[...requests].map(req => ({
            ctime: req.ctime,
            fullName: req.fullName,
            key: `invites-request:${req.username}`,
            type: 'invites-request' as const,
            username: req.username,
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
    case 'channels': {
      rows.push({key: 'channel-header', type: 'channel-header'})
      let channels: Array<{channel: Types.ChannelInfo; conversationIDKey: ChatTypes.ConversationIDKey}> = []
      channelInfos?.forEach((channel, conversationIDKey) => channels.push({channel, conversationIDKey}))
      channels
        .sort((a, b) =>
          a.channel.channelname === 'general'
            ? -1
            : b.channel.channelname === 'general'
            ? 1
            : a.channel.channelname.localeCompare(b.channel.channelname)
        )
        .forEach(({channel, conversationIDKey}) =>
          rows.push({
            channel,
            conversationIDKey,
            key: `channel-${channel.channelname}`,
            type: 'channel',
          })
        )
      rows.push({key: 'channel-footer', type: 'channel-footer'})
    }
  }
  return rows
}

export default makeRows
