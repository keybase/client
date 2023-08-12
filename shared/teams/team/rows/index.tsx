import * as C from '../../../constants'
import * as Chat2Types from '../../../constants/types/chat2'
import * as ChatConstants from '../../../constants/chat2'
import * as Constants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../styles'
import EmptyRow from './empty-row'
import LoadingRow from './loading'
import MemberRow from './member-row/container'
import type * as Types from '../../../constants/types/teams'
import type {Section as _Section} from '../../../common-adapters/section-list'
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
export type Section = _Section<any, SectionExtras>

const makeSingleRow = (key: string, renderItem: () => React.ReactNode) => ({data: ['row'], key, renderItem})

export const useMembersSections = (
  teamID: Types.TeamID,
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
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
      renderItem: ({index, item}) => (
        <MemberRow teamID={teamID} username={item.username} firstItem={index == 0} />
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
  teamID: Types.TeamID,
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
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
      renderItem: ({item}) => <BotRow teamID={teamID} username={item.username} />,
    },
    ...(yourOperations.manageBots ? [makeSingleRow('add-bots', () => <AddBotRow teamID={teamID} />)] : []),
  ]
}

export const useInvitesSections = (teamID: Types.TeamID, details: Types.TeamDetails): Array<Section> => {
  const invitesCollapsed = Constants.useState(s => s.invitesCollapsed)
  const collapsed = invitesCollapsed.has(teamID)
  const toggleInvitesCollapsed = Constants.useState(s => s.dispatch.toggleInvitesCollapsed)
  const onToggleCollapsed = () => toggleInvitesCollapsed(teamID)

  const sections: Array<Section> = []
  const resetMembers = [...(details.members?.values() ?? [])].filter(m => m.status === 'reset')

  if (details.requests?.size || resetMembers.length) {
    const requestsSection: _Section<
      Omit<React.ComponentProps<typeof RequestRow>, 'firstItem' | 'teamID'>,
      SectionExtras
    > = {
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
      renderItem: ({index, item}) => <RequestRow {...item} teamID={teamID} firstItem={index == 0} />,
      title: Styles.isMobile ? `Requests (${details.requests.size})` : undefined,
    }
    sections.push(requestsSection)
  }
  if (details.invites?.size) {
    sections.push({
      collapsed,
      data: collapsed ? [] : [...details.invites].sort(sortInvites),
      key: 'member-invites',
      onToggleCollapsed,
      renderItem: ({index, item}) => <InviteRow teamID={teamID} id={item.id} firstItem={index == 0} />,
      title: `Invitations (${details.invites.size})`,
    })
  }
  return sections
}
export const useChannelsSections = (
  teamID: Types.TeamID,
  yourOperations: Types.TeamOperations
): Array<Section> => {
  const isBig = ChatConstants.useState(s => ChatConstants.isBigTeam(s, teamID))
  const channels = Constants.useState(s => s.channelInfo.get(teamID))
  const canCreate = Constants.useState(s => Constants.getCanPerformByID(s, teamID).createChannel)

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
      renderItem: ({item}) => <ChannelRow teamID={teamID} conversationIDKey={item.conversationIDKey} />,
    },
    channels.size < 5 && yourOperations.createChannel
      ? makeSingleRow('channel-few', () => <EmptyRow type="channelsFew" teamID={teamID} />)
      : makeSingleRow('channel-info', () => <ChannelFooterRow />),
  ]
}

// When we delete the feature flag, clean this up a bit
export const useSubteamsSections = (
  teamID: Types.TeamID,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
): Array<Section> => {
  const subteamsFiltered = Constants.useState(s => s.subteamsFiltered)
  const subteams = [...(subteamsFiltered ?? details.subteams)].sort()
  const sections: Array<Section> = []

  if (yourOperations.manageSubteams && details.subteams.size) {
    sections.push(makeSingleRow('subteam-add', () => <SubteamAddRow teamID={teamID} />))
  }
  sections.push({
    data: subteams,
    key: 'subteams',
    renderItem: ({item, index}) => <SubteamTeamRow teamID={item} firstItem={index === 0} />,
  })

  if (details.subteams.size) {
    sections.push(makeSingleRow('subteam-info', () => <SubteamInfoRow />))
  } else {
    sections.push(makeSingleRow('subteam-none', () => <EmptyRow teamID={teamID} type="subteams" />))
  }
  return sections
}

const useGeneralConversationIDKey = (teamID?: Types.TeamID) => {
  const [conversationIDKey, setConversationIDKey] = React.useState<Chat2Types.ConversationIDKey | undefined>()
  const generalConvID = ChatConstants.useState(s =>
    teamID ? s.teamIDToGeneralConvID.get(teamID) : undefined
  )
  const findGeneralConvIDFromTeamID = ChatConstants.useState(s => s.dispatch.findGeneralConvIDFromTeamID)
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

export const useEmojiSections = (teamID: Types.TeamID, shouldActuallyLoad: boolean): Array<Section> => {
  const convID = useGeneralConversationIDKey(teamID)
  const [lastActuallyLoad, setLastActuallyLoad] = React.useState(false)
  const [lastCID, setLastCID] = React.useState(convID)
  const getUserEmoji = Container.useRPC(RPCChatTypes.localUserEmojisRpcPromise)
  const [customEmoji, setCustomEmoji] = React.useState<RPCChatTypes.Emoji[]>([])
  const [filter, setFilter] = React.useState('')

  const doGetUserEmoji = () => {
    if (!convID || convID === ChatConstants.noConversationIDKey || !shouldActuallyLoad) {
      return
    }
    getUserEmoji(
      [
        {
          convID: Chat2Types.keyToConversationID(convID),
          opts: {
            getAliases: true,
            getCreationInfo: true,
            onlyInTeam: true,
          },
        },
      ],
      result => {
        let emojis: Array<RPCChatTypes.Emoji> = []
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

  if (
    shouldActuallyLoad !== lastActuallyLoad ||
    convID !== lastCID ||
    lastUpdatedTrigger !== updatedTrigger
  ) {
    setLastActuallyLoad(shouldActuallyLoad)
    setLastCID(convID)
    setLastUpdatedTrigger(updatedTrigger)
    doGetUserEmoji()
  }

  Container.useOnMountOnce(() => {
    doGetUserEmoji()
  })

  let filteredEmoji: RPCChatTypes.Emoji[] = customEmoji
  if (filter != '') {
    filteredEmoji = filteredEmoji.filter(e => e.alias.includes(filter.toLowerCase()))
  }

  const sections: Array<Section> = []
  sections.push({
    data: ['emoji-add'],
    key: 'emoji-add',
    renderItem: () => (
      <EmojiAddRow
        teamID={teamID}
        convID={convID ?? ChatConstants.noConversationIDKey}
        filter={filter}
        setFilter={setFilter}
      />
    ),
  })

  if (customEmoji.length) {
    if (!Styles.isMobile) {
      sections.push({
        data: ['emoji-header'],
        key: 'emoji-header',
        renderItem: () => <EmojiHeader />,
      })
    }

    sections.push({
      data: filteredEmoji,
      key: 'emoji-item',
      renderItem: ({item, index}) => (
        <EmojiItemRow
          emoji={item}
          firstItem={index === 0}
          conversationIDKey={convID ?? ChatConstants.noConversationIDKey}
          teamID={teamID}
        />
      ),
    })
  }
  return sections
}
