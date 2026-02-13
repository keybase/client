import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import EmptyRow from './empty-row'
import LoadingRow from './loading'
import MemberRow from './member-row'
import {BotRow, AddBotRow} from './bot-row'
import {ChannelRow, ChannelHeaderRow, ChannelFooterRow} from './channel-row'
import {EmojiItemRow, EmojiAddRow, EmojiHeader} from './emoji-row'
import {RequestRow, InviteRow} from './invite-row'
import {SubteamAddRow, SubteamInfoRow, SubteamTeamRow} from './subteam-row'
import {getOrderedMemberArray, sortInvites, getOrderedBotsArray} from './helpers'
import {useEmojiState} from '../../emojis/use-emoji'
import {useCurrentUserState} from '@/stores/current-user'

type Requests = Omit<React.ComponentProps<typeof RequestRow>, 'firstItem' | 'teamID'>

export type Item =
  | {type: 'members-loading'}
  | {type: 'members-none'}
  | {type: 'member-members'; mi: T.Teams.MemberInfo}
  | {type: 'row'}
  | {type: 'invite-info'; ii: T.Teams.InviteInfo}
  | {type: 'requests'; r: Requests}
  | {type: 'channel-info'; ci: T.Teams.TeamChannelInfo}
  | {type: 'emoji'; e: T.RPCChat.Emoji}
  | {type: 'add-bots'}
  | {type: 'invite-requests'; ctime: number; fullName: string; reset?: boolean; username: string}
  | {type: 'member-invites'; ii: T.Teams.InviteInfo}
  | {type: 'channel-empty'}
  | {type: 'channel-loading'}
  | {type: 'channel-add'}
  | {
      type: 'channel-channels'
      c: {
        channelname: string
        conversationIDKey: T.Chat.ConversationIDKey
        description: string
      }
    }
  | {type: 'channel-few'}
  | {type: 'channel-info'}
  | {type: 'subteam-add'}
  | {type: 'subteam-info'}
  | {type: 'subteam-none'}
  | {type: 'emoji-add'}
  | {type: 'emoji-header'}
  | {type: 'emoji-item'; e: T.RPCChat.Emoji}
  | {type: 'subteams'; id: string}
  | {type: 'header'}
  | {type: 'tabs'}
  | {type: 'settings'}

export type Section = Kb.SectionType<Item> & {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  title?: string
}

export const useMembersSections = (
  teamID: T.Teams.TeamID,
  meta: T.Teams.TeamMeta,
  details: T.Teams.TeamDetails,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const yourUsername = useCurrentUserState(s => s.username)
  // TODO: figure out if this is bad for performance and if we should leave these functions early when we're not on that tab

  // TODO: consider moving this to the parent
  const stillLoading = meta.memberCount > 0 && !details.members.size
  if (stillLoading) {
    return [{data: [{type: 'members-loading'}], renderItem: () => <LoadingRow />} as const]
  }
  const sections: Array<Section> = [
    {
      data: getOrderedMemberArray(details.members, yourUsername, yourOperations).map(mi => ({
        mi,
        type: 'member-members',
      })),
      renderItem: ({index, item}: {index: number; item: Item}) =>
        item.type === 'member-members' ? (
          <MemberRow teamID={teamID} username={item.mi.username} firstItem={index === 0} />
        ) : null,
      title: `Already in team (${meta.memberCount})`,
    } as const,
  ]

  // When you're the only one in the team, still show the no-members row
  if (meta.memberCount === 0 || (meta.memberCount === 1 && meta.role !== 'none')) {
    sections.push({
      data: [{type: 'members-none'}],
      renderItem: () => <EmptyRow teamID={teamID} type="members" />,
    } as const)
  }
  return sections
}

export const useBotSections = (
  teamID: T.Teams.TeamID,
  meta: T.Teams.TeamMeta,
  details: T.Teams.TeamDetails,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const stillLoading = meta.memberCount > 0 && !details.members.size
  if (stillLoading) {
    return [{data: [{type: 'members-loading'}], renderItem: () => <LoadingRow />} as const]
  }
  // TODO: is there an empty state here?
  return [
    {
      data: getOrderedBotsArray(details.members).map(b => ({
        mi: b,
        type: 'member-members',
      })),
      renderItem: ({item}: {item: Item}) =>
        item.type === 'member-members' ? <BotRow teamID={teamID} username={item.mi.username} /> : null,
    } as const,
    ...(yourOperations.manageBots
      ? [{data: [{type: 'add-bots'}], renderItem: () => <AddBotRow teamID={teamID} />} as const]
      : []),
  ]
}

export const useInvitesSections = (teamID: T.Teams.TeamID, details: T.Teams.TeamDetails): Array<Section> => {
  const invitesCollapsed = Teams.useTeamsState(s => s.invitesCollapsed)
  const collapsed = invitesCollapsed.has(teamID)
  const toggleInvitesCollapsed = Teams.useTeamsState(s => s.dispatch.toggleInvitesCollapsed)
  const onToggleCollapsed = () => toggleInvitesCollapsed(teamID)

  const sections: Array<Section> = []
  const resetMembers = [...details.members.values()].filter(m => m.status === 'reset')

  if (details.requests.size || resetMembers.length) {
    const requestsSection = {
      data: [
        ...[...details.requests].map(
          req =>
            ({
              ctime: req.ctime,
              fullName: req.fullName,
              key: `invites-request:${req.username}`,
              type: 'invite-requests',
              username: req.username,
            }) as const
        ),
        ...resetMembers.map(
          memberInfo =>
            ({
              ctime: 0,
              fullName: memberInfo.fullName,
              key: `invites-reset:${memberInfo.username}`,
              reset: true,
              type: 'invite-requests',
              username: memberInfo.username,
            }) as const
        ),
      ],
      renderItem: ({index, item}: {index: number; item: Item}) =>
        item.type === 'invite-requests' ? (
          <RequestRow {...item} teamID={teamID} firstItem={index === 0} />
        ) : null,
      title: Kb.Styles.isMobile ? `Requests (${details.requests.size})` : undefined,
    } satisfies Section
    sections.push(requestsSection)
  }
  if (details.invites.size) {
    sections.push({
      collapsed,
      data: collapsed
        ? []
        : [...details.invites].sort(sortInvites).map(i => ({
            ii: i,
            type: 'member-invites',
          })),
      onToggleCollapsed,
      renderItem: ({index, item}: {index: number; item: Item}) =>
        item.type === 'member-invites' ? (
          <InviteRow teamID={teamID} id={item.ii.id} firstItem={index === 0} />
        ) : null,
      title: `Invitations (${details.invites.size})`,
    } as const)
  }
  return sections
}
export const useChannelsSections = (
  teamID: T.Teams.TeamID,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const isBig = Chat.useChatState(s => Chat.isBigTeam(s, teamID))
  const channels = Teams.useTeamsState(s => s.channelInfo.get(teamID))
  const canCreate = Teams.useTeamsState(s => Teams.getCanPerformByID(s, teamID).createChannel)

  if (!isBig) {
    return [
      {
        data: [{type: 'channel-empty'}],
        renderItem: () => <EmptyRow type="channelsEmpty" teamID={teamID} />,
      } as const,
    ]
  }
  if (!channels) {
    return [{data: [{type: 'channel-loading'}], renderItem: () => <LoadingRow />} as const]
  }
  const createRow = canCreate
    ? [{data: [{type: 'channel-add'}], renderItem: () => <ChannelHeaderRow teamID={teamID} />} as const]
    : []

  const channelsValues = [...channels.values()]
  return [
    ...createRow,
    {
      data: channelsValues
        .map(c => ({c, type: 'channel-channels'}))
        .sort((a, b) =>
          a.c.channelname === 'general'
            ? -1
            : b.c.channelname === 'general'
              ? 1
              : a.c.channelname.localeCompare(b.c.channelname)
        ),
      renderItem: ({item}: {item: Item}) =>
        item.type === 'channel-channels' ? (
          <ChannelRow teamID={teamID} conversationIDKey={item.c.conversationIDKey} />
        ) : null,
    },
    channels.size < 5 && yourOperations.createChannel
      ? ({
          data: [{type: 'channel-few'}] as const,
          renderItem: ({item}: {item: Item}) =>
            item.type === 'channel-few' ? <EmptyRow type="channelsFew" teamID={teamID} /> : null,
        } satisfies Section)
      : ({
          data: [{type: 'channel-info'}] as const,
          renderItem: ({item}: {item: Item}) => (item.type === 'channel-info' ? <ChannelFooterRow /> : null),
        } satisfies Section),
  ] as Array<Section>
}

// When we delete the feature flag, clean this up a bit
export const useSubteamsSections = (
  teamID: T.Teams.TeamID,
  details: T.Teams.TeamDetails,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const subteamsFiltered = Teams.useTeamsState(s => s.subteamsFiltered)
  const subteams = [...(subteamsFiltered ?? details.subteams)].sort()
  const sections: Array<Section> = []

  if (yourOperations.manageSubteams && details.subteams.size) {
    sections.push({
      data: [{type: 'subteam-add'}],
      renderItem: () => <SubteamAddRow teamID={teamID} />,
    } as const)
  }
  sections.push({
    data: subteams.map(s => ({id: s, type: 'subteams'})),
    renderItem: ({item, index}: {item: Item; index: number}) =>
      item.type === 'subteams' ? <SubteamTeamRow teamID={item.id} firstItem={index === 0} /> : null,
  } as const)

  if (details.subteams.size) {
    sections.push({data: [{type: 'subteam-info'}], renderItem: () => <SubteamInfoRow />} as const)
  } else {
    sections.push({
      data: [{type: 'subteam-none'}],
      renderItem: () => <EmptyRow teamID={teamID} type="subteams" />,
    } as const)
  }
  return sections
}

const useGeneralConversationIDKey = (teamID?: T.Teams.TeamID) => {
  const [conversationIDKey, setConversationIDKey] = React.useState<T.Chat.ConversationIDKey | undefined>()
  const generalConvID = Chat.useChatState(s => (teamID ? s.teamIDToGeneralConvID.get(teamID) : undefined))
  const findGeneralConvIDFromTeamID = Chat.useChatState(s => s.dispatch.findGeneralConvIDFromTeamID)
  React.useEffect(() => {
    if (!conversationIDKey && teamID) {
      if (!generalConvID) {
        findGeneralConvIDFromTeamID(teamID)
      } else {
        setConversationIDKey(generalConvID)
      }
    }
  }, [conversationIDKey, findGeneralConvIDFromTeamID, generalConvID, teamID])
  return conversationIDKey
}

export const useEmojiSections = (teamID: T.Teams.TeamID, shouldActuallyLoad: boolean): Array<Section> => {
  const convID = useGeneralConversationIDKey(teamID)
  const [lastActuallyLoad, setLastActuallyLoad] = React.useState(false)
  const getUserEmoji = C.useRPC(T.RPCChat.localUserEmojisRpcPromise)
  const [customEmoji, setCustomEmoji] = React.useState<T.RPCChat.Emoji[]>([])
  const [filter, setFilter] = React.useState('')

  const doGetUserEmoji = React.useCallback(() => {
    if (!convID || convID === Chat.noConversationIDKey || !shouldActuallyLoad) {
      return
    }
    getUserEmoji(
      [
        {
          convID: T.Chat.keyToConversationID(convID),
          opts: {
            getAliases: true,
            getCreationInfo: true,
            onlyInTeam: true,
          },
        },
      ],
      result => {
        let emojis: Array<T.RPCChat.Emoji> = []
        result.emojis.emojis?.forEach(g => {
          emojis = emojis.concat(g.emojis ?? [])
        })
        setCustomEmoji(emojis)
      },
      _ => setCustomEmoji([])
    )
  }, [convID, getUserEmoji, shouldActuallyLoad])

  const updatedTrigger = useEmojiState(s => s.emojiUpdatedTrigger)
  const [lastUpdatedTrigger, setLastUpdatedTrigger] = React.useState(updatedTrigger)

  React.useEffect(() => {
    if (shouldActuallyLoad !== lastActuallyLoad || lastUpdatedTrigger !== updatedTrigger) {
      setLastActuallyLoad(shouldActuallyLoad)
      setLastUpdatedTrigger(updatedTrigger)
      doGetUserEmoji()
    }
  }, [doGetUserEmoji, lastActuallyLoad, lastUpdatedTrigger, shouldActuallyLoad, updatedTrigger])

  C.useOnMountOnce(() => {
    doGetUserEmoji()
  })

  let filteredEmoji: T.RPCChat.Emoji[] = customEmoji
  if (filter !== '') {
    filteredEmoji = filteredEmoji.filter(e => e.alias.includes(filter.toLowerCase()))
  }

  const sections: Array<Section> = []
  sections.push({
    data: [{type: 'emoji-add'}],
    renderItem: () => (
      <EmojiAddRow
        teamID={teamID}
        convID={convID ?? Chat.noConversationIDKey}
        filter={filter}
        setFilter={setFilter}
      />
    ),
  } as const)

  if (customEmoji.length) {
    if (!Kb.Styles.isMobile) {
      sections.push({
        data: [{type: 'emoji-header'}],
        renderItem: () => <EmojiHeader />,
      } as const)
    }

    sections.push({
      data: filteredEmoji.map(e => ({e, type: 'emoji-item'})),
      renderItem: ({item, index}: {item: Item; index: number}) =>
        item.type === 'emoji-item' ? (
          <EmojiItemRow
            emoji={item.e}
            firstItem={index === 0}
            conversationIDKey={convID ?? Chat.noConversationIDKey}
            teamID={teamID}
          />
        ) : null,
    } as const)
  }
  return sections
}
