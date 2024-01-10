import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import EmptyRow from './empty-row'
import LoadingRow from './loading'
import MemberRow from './member-row/container'
import type {Section as _Section} from '@/common-adapters/section-list'
import {BotRow, AddBotRow} from './bot-row'
import {ChannelRow, ChannelHeaderRow, ChannelFooterRow} from './channel-row'
import {EmojiItemRow, EmojiAddRow, EmojiHeader} from './emoji-row'
import {RequestRow, InviteRow} from './invite-row'
import {SubteamAddRow, SubteamInfoRow, SubteamTeamRow} from './subteam-row'
import {getOrderedMemberArray, sortInvites, getOrderedBotsArray} from './helpers'
import {useEmojiState} from '../../emojis/use-emoji'

type SectionExtras = {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  title?: string
}

type Requests = Omit<React.ComponentProps<typeof RequestRow>, 'firstItem' | 'teamID'>

export type Section =
  | _Section<T.Teams.MemberInfo, SectionExtras>
  | _Section<'row', SectionExtras>
  | _Section<T.Teams.InviteInfo, SectionExtras>
  | _Section<Requests, SectionExtras>
  | _Section<T.Teams.TeamChannelInfo, SectionExtras>
  | _Section<string, SectionExtras>
  | _Section<T.RPCChat.Emoji, SectionExtras>

const makeSingleRow = (key: string, renderItem: () => React.ReactElement | null): Section => ({
  data: ['row'] as const,
  key,
  renderItem,
})

export const useMembersSections = (
  teamID: T.Teams.TeamID,
  meta: T.Teams.TeamMeta,
  details: T.Teams.TeamDetails,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const yourUsername = C.useCurrentUserState(s => s.username)
  // TODO: figure out if this is bad for performance and if we should leave these functions early when we're not on that tab

  // TODO: consider moving this to the parent
  const stillLoading = meta.memberCount > 0 && !details.members.size
  if (stillLoading) {
    return [makeSingleRow('members-loading', () => <LoadingRow />)]
  }
  const sections: Array<Section> = [
    {
      data: getOrderedMemberArray(details.members, yourUsername, yourOperations),
      key: 'member-members',
      renderItem: ({index, item}: {index: number; item: T.Teams.MemberInfo}) => (
        <MemberRow teamID={teamID} username={item.username} firstItem={index === 0} />
      ),
      title: `Already in team (${meta.memberCount})`,
    },
  ]

  // When you're the only one in the team, still show the no-members row
  if (meta.memberCount === 0 || (meta.memberCount === 1 && meta.role !== 'none')) {
    sections.push(makeSingleRow('members-none', () => <EmptyRow teamID={teamID} type="members" />))
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
    return [makeSingleRow('loading', () => <LoadingRow />)]
  }
  // TODO: is there an empty state here?
  return [
    {
      data: getOrderedBotsArray(details.members),
      key: 'bots',
      renderItem: ({item}: {item: T.Teams.MemberInfo}) => <BotRow teamID={teamID} username={item.username} />,
    },
    ...(yourOperations.manageBots ? [makeSingleRow('add-bots', () => <AddBotRow teamID={teamID} />)] : []),
  ]
}

export const useInvitesSections = (teamID: T.Teams.TeamID, details: T.Teams.TeamDetails): Array<Section> => {
  const invitesCollapsed = C.useTeamsState(s => s.invitesCollapsed)
  const collapsed = invitesCollapsed.has(teamID)
  const toggleInvitesCollapsed = C.useTeamsState(s => s.dispatch.toggleInvitesCollapsed)
  const onToggleCollapsed = () => toggleInvitesCollapsed(teamID)

  const sections: Array<Section> = []
  const resetMembers = [...details.members.values()].filter(m => m.status === 'reset')

  if (details.requests.size || resetMembers.length) {
    const requestsSection: _Section<Requests, SectionExtras> = {
      data: [
        ...[...details.requests].map(req => ({
          ctime: req.ctime,
          fullName: req.fullName,
          key: `invites-request:${req.username}`,
          username: req.username,
        })),
        ...resetMembers.map(memberInfo => ({
          ctime: 0,
          fullName: memberInfo.fullName,
          key: `invites-reset:${memberInfo.username}`,
          reset: true,
          username: memberInfo.username,
        })),
      ],
      key: 'invite-requests',
      renderItem: ({index, item}) => <RequestRow {...item} teamID={teamID} firstItem={index === 0} />,
      title: Kb.Styles.isMobile ? `Requests (${details.requests.size})` : undefined,
    }
    sections.push(requestsSection)
  }
  if (details.invites.size) {
    sections.push({
      collapsed,
      data: collapsed ? [] : [...details.invites].sort(sortInvites),
      key: 'member-invites',
      onToggleCollapsed,
      renderItem: ({index, item}: {index: number; item: T.Teams.InviteInfo}) => (
        <InviteRow teamID={teamID} id={item.id} firstItem={index === 0} />
      ),
      title: `Invitations (${details.invites.size})`,
    })
  }
  return sections
}
export const useChannelsSections = (
  teamID: T.Teams.TeamID,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const isBig = C.useChatState(s => C.Chat.isBigTeam(s, teamID))
  const channels = C.useTeamsState(s => s.channelInfo.get(teamID))
  const canCreate = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID).createChannel)

  if (!isBig) {
    return [makeSingleRow('channel-empty', () => <EmptyRow type="channelsEmpty" teamID={teamID} />)]
  }
  if (!channels) {
    return [makeSingleRow('channel-loading', () => <LoadingRow />)]
  }
  const createRow = canCreate
    ? [makeSingleRow('channel-add', () => <ChannelHeaderRow teamID={teamID} />)]
    : []
  return [
    ...createRow,
    {
      data: [...channels.values()].sort((a, b) =>
        a.channelname === 'general'
          ? -1
          : b.channelname === 'general'
            ? 1
            : a.channelname.localeCompare(b.channelname)
      ),
      key: 'channel-channels',
      renderItem: ({item}: {item: T.Teams.TeamChannelInfo}) => (
        <ChannelRow teamID={teamID} conversationIDKey={item.conversationIDKey} />
      ),
    },
    channels.size < 5 && yourOperations.createChannel
      ? makeSingleRow('channel-few', () => <EmptyRow type="channelsFew" teamID={teamID} />)
      : makeSingleRow('channel-info', () => <ChannelFooterRow />),
  ] as const
}

// When we delete the feature flag, clean this up a bit
export const useSubteamsSections = (
  teamID: T.Teams.TeamID,
  details: T.Teams.TeamDetails,
  yourOperations: T.Teams.TeamOperations
): Array<Section> => {
  const subteamsFiltered = C.useTeamsState(s => s.subteamsFiltered)
  const subteams = [...(subteamsFiltered ?? details.subteams)].sort()
  const sections: Array<Section> = []

  if (yourOperations.manageSubteams && details.subteams.size) {
    sections.push(makeSingleRow('subteam-add', () => <SubteamAddRow teamID={teamID} />))
  }
  sections.push({
    data: subteams,
    key: 'subteams',
    renderItem: ({item, index}: {item: string; index: number}) => (
      <SubteamTeamRow teamID={item} firstItem={index === 0} />
    ),
  })

  if (details.subteams.size) {
    sections.push(makeSingleRow('subteam-info', () => <SubteamInfoRow />))
  } else {
    sections.push(makeSingleRow('subteam-none', () => <EmptyRow teamID={teamID} type="subteams" />))
  }
  return sections
}

const useGeneralConversationIDKey = (teamID?: T.Teams.TeamID) => {
  const [conversationIDKey, setConversationIDKey] = React.useState<T.Chat.ConversationIDKey | undefined>()
  const generalConvID = C.useChatState(s => (teamID ? s.teamIDToGeneralConvID.get(teamID) : undefined))
  const findGeneralConvIDFromTeamID = C.useChatState(s => s.dispatch.findGeneralConvIDFromTeamID)
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
  const cidChanged = C.Chat.useCIDChanged(convID)
  const getUserEmoji = C.useRPC(T.RPCChat.localUserEmojisRpcPromise)
  const [customEmoji, setCustomEmoji] = React.useState<T.RPCChat.Emoji[]>([])
  const [filter, setFilter] = React.useState('')

  const doGetUserEmoji = () => {
    if (!convID || convID === C.Chat.noConversationIDKey || !shouldActuallyLoad) {
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
  }

  const updatedTrigger = useEmojiState(s => s.emojiUpdatedTrigger)
  const [lastUpdatedTrigger, setLastUpdatedTrigger] = React.useState(updatedTrigger)

  if (shouldActuallyLoad !== lastActuallyLoad || cidChanged || lastUpdatedTrigger !== updatedTrigger) {
    setLastActuallyLoad(shouldActuallyLoad)
    setLastUpdatedTrigger(updatedTrigger)
    doGetUserEmoji()
  }

  C.useOnMountOnce(() => {
    doGetUserEmoji()
  })

  let filteredEmoji: T.RPCChat.Emoji[] = customEmoji
  if (filter !== '') {
    filteredEmoji = filteredEmoji.filter(e => e.alias.includes(filter.toLowerCase()))
  }

  const sections: Array<Section> = []
  sections.push({
    data: ['emoji-add'],
    key: 'emoji-add',
    renderItem: () => (
      <EmojiAddRow
        teamID={teamID}
        convID={convID ?? C.Chat.noConversationIDKey}
        filter={filter}
        setFilter={setFilter}
      />
    ),
  })

  if (customEmoji.length) {
    if (!Kb.Styles.isMobile) {
      sections.push({
        data: ['emoji-header'],
        key: 'emoji-header',
        renderItem: () => <EmojiHeader />,
      })
    }

    sections.push({
      data: filteredEmoji,
      key: 'emoji-item',
      renderItem: ({item, index}: {item: T.RPCChat.Emoji; index: number}) => (
        <EmojiItemRow
          emoji={item}
          firstItem={index === 0}
          conversationIDKey={convID ?? C.Chat.noConversationIDKey}
          teamID={teamID}
        />
      ),
    })
  }
  return sections
}
