import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import * as Common from './common'
import * as Kb from '@/common-adapters'
import {useUsersState} from '@/stores/users'
import {useChatTeamMembers} from '../../team-hooks'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {useConversationMetadata} from '../../data-hooks'
import {registerExternalResetter} from '@/util/zustand'

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  iconPeople: {
    backgroundColor: Kb.Styles.globalColors.white,
    ...Kb.Styles.border(Kb.Styles.globalColors.black_10, 1, 16),
    ...Kb.Styles.size(32),
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
    const first = sortedTeams[0]!
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

const getTeams = (layout?: T.RPCChat.UIInboxLayout) => {
  const bigTeams =
    layout?.bigTeams?.reduce<Array<string>>((arr, l) => {
      if (l.state === T.RPCChat.UIInboxBigTeamRowTyp.label) {
        arr.push(l.label.name)
      }
      return arr
    }, []) ?? []
  const smallTeams =
    layout?.smallTeams?.reduce<Array<string>>((arr, l) => {
      if (l.isTeam) {
        arr.push(l.name)
      }
      return arr
    }, []) ?? []
  return bigTeams.concat(smallTeams).map(teamname => ({channelname: '', teamname}))
}

const useDataUsers = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const infoMap = useUsersState(s => s.infoMap)
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const {teamID, teamType} = meta
  const {loading: loadingTeamMembers, members: teamMembers} = useChatTeamMembers(teamID)
  const suggestions =
    teamType !== 'adhoc' && !loadingTeamMembers && teamMembers.size > 0
      ? [...teamMembers.values()]
          .sort((a, b) => a.username.localeCompare(b.username))
          .map(member => ({
            fullName: member.fullName || infoMap.get(member.username)?.fullname || '',
            username: member.username,
          }))
      : participantInfo.all.map(username => ({
          fullName: infoMap.get(username)?.fullname || '',
          username,
        }))
  if (teamType !== 'adhoc') {
    const fullName = teamType === 'small' ? 'Everyone in this team' : 'Everyone in this channel'
    suggestions.push({fullName, username: 'channel'}, {fullName, username: 'here'})
  }
  return suggestions
}

const useDataTeams = () => {
  const inboxLayout = useInboxLayoutState(s => s.layout)
  const teams = getTeams(inboxLayout)
  const allChannels = inboxLayout?.bigTeams?.reduce<Array<TeamListItem>>((arr, t) => {
    if (t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel) {
      if (t.channel.channelname.length) {
        arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
      }
    }
    return arr
  }, []) ?? []
  return {allChannels, teams}
}

const useDataSource = (conversationIDKey: T.Chat.ConversationIDKey, filter: string) => {
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
  'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  conversationIDKey: T.Chat.ConversationIDKey
  filter: string
  onSelected: (item: ListItem, final: boolean) => void
  setOnMoveRef: (r: (up: boolean) => void) => void
  setOnSubmitRef: (r: () => boolean) => void
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
      style={Kb.Styles.collapseStyles([
        Common.styles.suggestionBase,
        Common.styles.fixSuggestionHeight,
        {backgroundColor: selected ? Kb.Styles.globalColors.blueLighter2 : Kb.Styles.globalColors.white},
      ])}
      gap="tiny"
    >
      {Chat.isSpecialMention(username ?? '') ? (
        <Kb.Box2 direction="horizontal" style={styles.iconPeople} centerChildren={true}>
          <Kb.Icon type="iconfont-people" color={Kb.Styles.globalColors.blueDark} fontSize={16} />
        </Kb.Box2>
      ) : (
        <Kb.Avatar username={username} size={Common.avatarSize} />
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

// filtering rebuilds item objects every keystroke; reuse prior identities so
// the memoized suggestion rows can bail. Bounded by users/channels ever
// suggested; the size guard is a backstop for pathological accounts.
const listItemCache = new Map<string, ListItem>()

// module scope outlives sign-out; keyed by username / team#channel
registerExternalResetter('chat-user-suggestor-item-cache', () => {
  listItemCache.clear()
})
const canonicalizeItems = (items: Array<ListItem>) => {
  if (listItemCache.size > 8192) {
    listItemCache.clear()
  }
  return items.map(item => {
    const key = keyExtractor(item)
    const old = listItemCache.get(key)
    if (
      old &&
      old.username === item.username &&
      old.fullName === item.fullName &&
      old.teamname === item.teamname &&
      old.channelname === item.channelname
    ) {
      return old
    }
    listItemCache.set(key, item)
    return item
  })
}

export const UsersList = (p: ListProps) => {
  const {conversationIDKey, filter, ...rest} = p
  const items = canonicalizeItems(useDataSource(conversationIDKey, filter))
  return (
    <Common.List
      {...rest}
      keyExtractor={keyExtractor}
      items={items}
      ItemRenderer={ItemRenderer}
      loading={false}
      rowHeight={Common.avatarRowHeight}
    />
  )
}
