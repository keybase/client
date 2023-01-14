import * as Common from './common'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'
import {useMemo} from '../../../../util/memoize'

export const transformer = (
  input: {
    fullName: string
    username: string
    teamname?: string
    channelname?: string
  },
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) => {
  let s: string
  if (input.teamname) {
    if (input.channelname) {
      s = input.teamname + '#' + input.channelname
    } else {
      s = input.teamname
    }
  } else {
    s = input.username
  }
  return Common.standardTransformer(`${marker}${s}`, tData, preview)
}

const styles = Styles.styleSheetCreate(() => ({
  iconPeople: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: 16,
    borderStyle: 'solid',
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
}))

const filterTeamNameChannel = (fil: string, allChannels: Array<TeamListItem>) => {
  const match = fil.match(/^([a-zA-Z0-9_.]+)#(\S*)$/) // team name followed by #
  if (!match) return null
  const teamname = match[1]
  const channelfil = match[2]
  if (!channelfil) {
    // All the team's channels
    return allChannels.filter(v => v.teamname === teamname)
  }
  return allChannels
    .filter(v => v.teamname === teamname)
    .map(v => {
      let score = 0
      const channelname = v.channelname.toLowerCase()
      if (channelname.includes(channelfil)) {
        score++
      }
      if (channelname.startsWith(channelfil)) {
        score += 2
      }
      return {score, v}
    })
    .filter(withScore => !!withScore.score)
    .sort((a, b) => b.score - a.score)
    .map(({v}) => v)
}

const filterUsersAndTeams = (
  users: Array<UserListItem>,
  teams: Array<TeamListItem>,
  allChannels: Array<TeamListItem>,
  filter: string
) => {
  const sortedUsers = users
    .map(user => {
      let score = 0
      const username = user.username.toLowerCase()
      const fullName = user.fullName.toLowerCase()
      if (username.includes(filter) || fullName.includes(filter)) {
        // 1 point for included somewhere
        score++
      }
      if (fullName.startsWith(filter)) {
        // 1 point for start of fullname
        score++
      }
      if (username.startsWith(filter)) {
        // 2 points for start of username
        score += 2
      }
      return {score, user}
    })
    .filter(withScore => !!withScore.score)
    .sort((a, b) => b.score - a.score)
    .map(userWithScore => userWithScore.user)
  const sortedTeams = teams.filter(t => {
    return t.teamname.includes(filter)
  })

  if (sortedUsers.length === 0 && sortedTeams.length === 1) {
    const first = sortedTeams[0]
    // The only user+team result is a single team. Present its channels as well.
    return [first, ...allChannels.filter(v => v.teamname === first.teamname)]
  }
  return [...sortedUsers, ...sortedTeams]
}

const filterAndJoin = (
  users: Array<UserListItem>,
  teams: Array<TeamListItem>,
  allChannels: Array<TeamListItem>,
  filter: string
) => {
  if (!filter) {
    return [...users, ...teams.sort((a, b) => a.teamname.localeCompare(b.teamname))]
  }
  const teamNames = filterTeamNameChannel(filter, allChannels)
  return teamNames ? teamNames : filterUsersAndTeams(users, teams, allChannels, filter)
}

const getTeams = (layout: RPCChatTypes.UIInboxLayout | null) => {
  const bigTeams =
    layout?.bigTeams?.reduce<Array<string>>((arr, l) => {
      l.state === RPCChatTypes.UIInboxBigTeamRowTyp.label && arr.push(l.label.name)
      return arr
    }, []) ?? []
  const smallTeams =
    layout?.smallTeams?.reduce<Array<string>>((arr, l) => {
      l.isTeam && arr.push(l.name)
      return arr
    }, []) ?? []
  return bigTeams.concat(smallTeams).map(teamname => ({channelname: '', teamname}))
}

const useDataUsers = (conversationIDKey: Types.ConversationIDKey) => {
  return Container.useSelector(state => {
    const {teamID, teamType} = Constants.getMeta(state, conversationIDKey)
    const teamMembers = state.teams.teamIDToMembers.get(teamID)
    const infoMap = state.users.infoMap
    const usernames = teamMembers
      ? [...teamMembers.values()].map(m => m.username).sort((a, b) => a.localeCompare(b))
      : Constants.getParticipantInfo(state, conversationIDKey).all
    const suggestions = usernames.map(username => ({
      fullName: infoMap.get(username)?.fullname || '',
      username,
    }))
    if (teamType !== 'adhoc') {
      const fullName = teamType === 'small' ? 'Everyone in this team' : 'Everyone in this channel'
      suggestions.push({fullName, username: 'channel'}, {fullName, username: 'here'})
    }
    // TODO this will thrash on every store change, TODO fix
    return suggestions
  })
}

const useDataTeams = () => {
  const inboxLayout = Container.useSelector(state => state.chat2.inboxLayout)
  const teams = useMemo(() => getTeams(inboxLayout), [inboxLayout])
  const allChannels = useMemo(
    () =>
      inboxLayout?.bigTeams?.reduce<Array<TeamListItem>>((arr, t) => {
        if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
          arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
        }
        return arr
      }, []) ?? [],
    [inboxLayout]
  )
  return {allChannels, teams}
}

const useDataSource = (conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const fl = filter.toLowerCase()
  const users = useDataUsers(conversationIDKey)
  const {teams, allChannels} = useDataTeams()
  return filterAndJoin(users, teams, allChannels, fl)
}

type UserListItem = {
  username: string
  fullName: string
}

type TeamListItem = {
  teamname: string
  channelname: string
}

type ListItem = {
  username?: string
  fullName?: string
  teamname?: string
  channelname?: string
}

type ListProps = Pick<
  Common.ListProps<ListItem>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  conversationIDKey: Types.ConversationIDKey
  filter: string
  onSelected: (item: ListItem, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
}

const ItemRenderer = (p: Common.ItemRendererProps<ListItem>) => {
  const {selected, item} = p
  const {username, fullName, teamname, channelname} = item

  if (teamname) {
    return <Common.TeamSuggestion teamname={teamname} channelname={channelname} selected={selected} />
  }

  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Styles.collapseStyles([
        Common.styles.suggestionBase,
        Common.styles.fixSuggestionHeight,
        {backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white},
      ])}
      gap="tiny"
    >
      {Constants.isSpecialMention(username ?? '') ? (
        <Kb.Box2 direction="horizontal" style={styles.iconPeople}>
          <Kb.Icon type="iconfont-people" color={Styles.globalColors.blueDark} fontSize={16} />
        </Kb.Box2>
      ) : (
        <Kb.Avatar username={username} size={32} />
      )}
      <Kb.ConnectedUsernames
        type="BodyBold"
        colorFollowing={true}
        usernames={username ?? ''}
        withProfileCardPopup={false}
      />
      <Kb.Text type="BodySmall">{fullName}</Kb.Text>
    </Kb.Box2>
  )
}

const keyExtractor = (item: ListItem) => {
  const {teamname, channelname} = item
  if (teamname) {
    return channelname ? teamname + '#' + channelname : teamname
  }
  return item.username ?? ''
}

export const UsersList = (p: ListProps) => {
  const {filter, ...rest} = p
  const items = useDataSource(p.conversationIDKey, filter)
  return (
    <Common.List
      {...rest}
      keyExtractor={keyExtractor}
      items={items}
      ItemRenderer={ItemRenderer}
      loading={false}
    />
  )
}
