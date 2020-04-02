import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Constants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import {Section as _Section} from '../../../common-adapters/section-list'
import flags from '../../../util/feature-flags'
import {useAllChannelMetas} from '../../common/channel-hooks'
import {getOrderedMemberArray, sortInvites, getOrderedBotsArray} from './helpers'
import MemberRow from './member-row/container'
import {BotRow, AddBotRow} from './bot-row'
import {RequestRow, InviteRow, InvitesEmptyRow} from './invite-row'
import {SubteamAddRow, SubteamIntroRow, SubteamNoneRow, SubteamTeamRow, SubteamInfoRow} from './subteam-row'
import {ChannelRow, ChannelHeaderRow, ChannelFooterRow} from './channel-row'
import LoadingRow from './loading'
import EmptyRow from './empty-row'

export type Section = _Section<
  any,
  {
    collapsed?: boolean
    onToggleCollapsed?: () => void
    title?: string
  }
>

const makeSingleRow = (key: string, renderItem: () => React.ReactNode) => ({data: ['row'], key, renderItem})

export const useMembersSections = (
  teamID: Types.TeamID,
  meta: Types.TeamMeta,
  details: Types.TeamDetails,
  yourOperations: Types.TeamOperations
): Array<Section> => {
  const yourUsername = Container.useSelector(state => state.config.username)
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
      title: flags.teamsRedesign ? `Already in team (${meta.memberCount})` : '',
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
  const invitesCollapsed = Container.useSelector(state => state.teams.invitesCollapsed)
  const dispatch = Container.useDispatch()
  const collapsed = invitesCollapsed.has(teamID)
  const onToggleCollapsed = () => dispatch(TeamsGen.createToggleInvitesCollapsed({teamID}))

  const sections: Array<Section> = []

  let empty = true
  if (details.requests?.size) {
    empty = false
    sections.push({
      data: [...details.requests].map(req => {
        return {
          ctime: req.ctime,
          fullName: req.fullName,
          key: `invites-request:${req.username}`,
          username: req.username,
        }
      }),
      key: 'invite-requests',
      renderItem: ({item}) => <RequestRow {...item} teamID={teamID} />,
      title: Styles.isMobile ? `Requests (${details.requests.size})` : undefined,
    })
  }
  if (details.invites?.size) {
    empty = false
    sections.push({
      collapsed,
      data: collapsed ? [] : [...details.invites].sort(sortInvites),
      key: 'member-invites',
      onToggleCollapsed,
      renderItem: ({index, item}) => <InviteRow teamID={teamID} id={item.id} firstItem={index == 0} />,
      title: `Invitations (${details.invites.size})`,
    })
  }
  if (empty && !flags.teamsRedesign) {
    sections.push(makeSingleRow('invites-empty', () => <InvitesEmptyRow />))
  }
  return sections
}

export const useChannelsSections = (
  teamID: Types.TeamID,
  yourOperations: Types.TeamOperations,
  shouldActuallyLoad: boolean
): Array<Section> => {
  const isBig = Container.useSelector(state => Constants.isBigTeam(state, teamID))
  const channelMetas = useAllChannelMetas(teamID, !isBig || !shouldActuallyLoad /* dontCallRPC */)
  // TODO: loading state (waiting on channel hook returning loading to merge)
  if (!isBig) {
    return [makeSingleRow('channel-empty', () => <EmptyRow type="channelsEmpty" teamID={teamID} />)]
  }
  return [
    makeSingleRow('channel-add', () => <ChannelHeaderRow teamID={teamID} />),
    {
      data: [...channelMetas.values()].sort((a, b) =>
        a.channelname === 'general'
          ? -1
          : b.channelname === 'general'
          ? 1
          : a.channelname.localeCompare(b.channelname)
      ),
      key: 'channel-channels',
      renderItem: ({item}) => <ChannelRow teamID={teamID} channel={item} />,
    },
    channelMetas?.size < 5 && yourOperations.createChannel
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
  const subteamsFiltered = Container.useSelector(state => state.teams.subteamsFiltered)
  const subteams = (flags.teamsRedesign
    ? [...(subteamsFiltered ?? details.subteams)]
    : [...details.subteams]
  ).sort()
  const sections: Array<Section> = []

  if (!flags.teamsRedesign) {
    sections.push(makeSingleRow('subteam-intro', () => <SubteamIntroRow teamID={teamID} />))
  }
  if (yourOperations.manageSubteams && (!flags.teamsRedesign || subteams.length)) {
    sections.push(makeSingleRow('subteam-add', () => <SubteamAddRow teamID={teamID} />))
  }
  sections.push({data: subteams, key: 'subteams', renderItem: ({item}) => <SubteamTeamRow teamID={item} />})

  if (flags.teamsRedesign && subteams.length) {
    sections.push(makeSingleRow('subteam-info', () => <SubteamInfoRow />))
  } else if (flags.teamsRedesign) {
    sections.push(makeSingleRow('subteam-none', () => <EmptyRow teamID={teamID} type="subteams" />))
  } else if (!subteams.length) {
    sections.push(makeSingleRow('subteam-none', () => <SubteamNoneRow />))
  }
  return sections
}
