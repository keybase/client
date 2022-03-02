import * as Common from './common'
import {memoize} from '../../../../util/memoize'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'

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

export const keyExtractor = ({
  username,
  teamname,
  channelname,
}: {
  username: string
  teamname?: string
  channelname?: string
}) => {
  if (teamname) {
    if (channelname) {
      return teamname + '#' + channelname
    } else {
      return teamname
    }
  } else {
    return username
  }
}

export const Renderer = (p: any) => {
  const selected: boolean = p.selected
  const username: string = p.value.username
  const fullName: string = p.value.fullName
  const teamname: string | undefined = p.value.teamname
  const channelname: string | undefined = p.value.channelname

  return teamname ? (
    <Common.TeamSuggestion teamname={teamname} channelname={channelname} selected={selected} />
  ) : (
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
      {Constants.isSpecialMention(username) ? (
        <Kb.Box2 direction="horizontal" style={styles.iconPeople}>
          <Kb.Icon type="iconfont-people" color={Styles.globalColors.blueDark} fontSize={16} />
        </Kb.Box2>
      ) : (
        <Kb.Avatar username={username} size={32} />
      )}
      <Kb.ConnectedUsernames
        type="BodyBold"
        colorFollowing={true}
        usernames={username}
        withProfileCardPopup={false}
      />
      <Kb.Text type="BodySmall">{fullName}</Kb.Text>
    </Kb.Box2>
  )
}

export const styles = Styles.styleSheetCreate(() => ({
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

const searchUsersAndTeamsAndTeamChannels = memoize(
  (users: any, teams: any, allChannels: any, filter: string) => {
    if (!filter) {
      return [...users, ...teams]
    }
    const fil = filter.toLowerCase()
    const match = fil.match(/^([a-zA-Z0-9_.]+)#(\S*)$/) // team name followed by #
    if (match) {
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
    const sortedUsers = users
      .map(u => {
        let score = 0
        const username = u.username.toLowerCase()
        const fullName = u.fullName.toLowerCase()
        if (username.includes(fil) || fullName.includes(fil)) {
          // 1 point for included somewhere
          score++
        }
        if (fullName.startsWith(fil)) {
          // 1 point for start of fullname
          score++
        }
        if (username.startsWith(fil)) {
          // 2 points for start of username
          score += 2
        }
        return {score, user: u}
      })
      .filter(withScore => !!withScore.score)
      .sort((a, b) => b.score - a.score)
      .map(userWithScore => userWithScore.user)
    const sortedTeams = teams.filter(t => {
      return t.teamname.includes(fil)
    })
    const usersAndTeams = [...sortedUsers, ...sortedTeams]
    if (usersAndTeams.length === 1 && usersAndTeams[0].teamname) {
      // The only user+team result is a single team. Present its channels as well.
      return [...usersAndTeams, ...allChannels.filter(v => v.teamname === usersAndTeams[0].teamname)]
    }
    return usersAndTeams
  }
)

const getTeams = memoize((layout: RPCChatTypes.UIInboxLayout | null) => {
  const bigTeams = (layout && layout.bigTeams) || []
  const smallTeams = (layout && layout.smallTeams) || []
  const bigTeamNames = bigTeams.reduce<Array<string>>((arr, l) => {
    if (l.state === RPCChatTypes.UIInboxBigTeamRowTyp.label) {
      arr.push(l.label.name)
    }
    return arr
  }, [])
  const smallTeamNames = smallTeams.reduce<Array<string>>((arr, l) => {
    if (l.isTeam) {
      arr.push(l.name)
    }
    return arr
  }, [])
  return bigTeamNames
    .concat(smallTeamNames)
    .sort()
    .map(teamname => ({fullName: '', teamname, username: ''}))
})

export const useDataSource = (active: string, conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const isActive = active === 'users'
  return Container.useSelector(state => {
    if (!isActive) return null

    const suggestUsers = Constants.getParticipantSuggestions(state, conversationIDKey)
    const inboxLayout = state.chat2.inboxLayout
    const suggestTeams = getTeams(inboxLayout)
    const suggestAllChannels = (inboxLayout?.bigTeams ?? []).reduce<
      Array<{teamname: string; channelname: string}>
    >((arr, t) => {
      if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
        arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
      }
      return arr
    }, [])
    return {
      data: searchUsersAndTeamsAndTeamChannels(suggestUsers, suggestTeams, suggestAllChannels, filter),
      loading: false,
      useSpaces: false,
    }
  })
}
