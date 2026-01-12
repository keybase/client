import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {getAddedUsernames} from '../system-users-added-to-conv/container'
import {indefiniteArticle} from '@/util/string'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {message: T.Chat.MessageSystemAddedToTeam}

const SystemAddedToTeamContainer = React.memo(function SystemAddedToTeamContainer(p: OwnProps) {
  const {message} = p
  const {addee, adder, author, bulkAdds, role: _role, timestamp} = message
  const meta = Chat.useChatContext(s => s.meta)
  const {teamID, teamname, teamType} = meta
  const authorIsAdmin = Teams.useTeamsState(s => Teams.userIsRoleInTeam(s, teamID, author, 'admin'))
  const authorIsOwner = Teams.useTeamsState(s => Teams.userIsRoleInTeam(s, teamID, author, 'owner'))
  const you = useCurrentUserState(s => s.username)
  const isAdmin = authorIsAdmin || authorIsOwner
  const isTeam = teamType === 'big' || teamType === 'small'

  const showInfoPanel = Chat.useChatContext(s => s.dispatch.showInfoPanel)
  const onManageNotifications = React.useCallback(() => {
    showInfoPanel(true, 'settings')
  }, [showInfoPanel])

  const navigateAppend = Chat.useChatNavigateAppend()
  const onViewBot = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({
      props: {botUsername: addee, conversationIDKey},
      selected: 'chatInstallBot',
    }))
  }, [navigateAppend, addee])

  const onViewTeam = React.useCallback(() => {
    if (teamID) {
      navigateAppend(() => ({props: {teamID}, selected: 'team'}))
    } else {
      showInfoPanel(true, 'settings')
    }
  }, [navigateAppend, showInfoPanel, teamID])

  const role = _role !== 'none' && isBot(_role) ? Teams.typeToLabel[_role].toLowerCase() : null
  const mc = (
    <ManageComponent
      addee={addee}
      role={_role}
      onManageNotifications={onManageNotifications}
      onViewBot={onViewBot}
      onViewTeam={onViewTeam}
      isTeam={isTeam}
      teamname={teamname}
      timestamp={timestamp}
      you={you}
      isAdmin={isAdmin}
    />
  )
  if (addee === you) {
    return (
      <UserNotice>
        <Kb.Text type="BodySmall">
          {youOrUsername({capitalize: true, username: adder, you})}added{' '}
          {youOrUsername({adder, capitalize: false, username: addee, you})}
          {teamname && ` to `}
          {teamname && (
            <Kb.Text
              onClick={onViewTeam}
              style={{color: Kb.Styles.globalColors.black_50}}
              type="BodySmallSemiboldSecondaryLink"
            >
              {teamname}
            </Kb.Text>
          )}
          {_role !== 'none' &&
            Teams.typeToLabel[_role] &&
            ` as ${indefiniteArticle(_role)} ${Teams.typeToLabel[_role].toLowerCase()}`}
          .
        </Kb.Text>
        {mc}
      </UserNotice>
    )
  }
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {youOrUsername({capitalize: true, username: adder, you: you})}added{' '}
        {getAddedUsernames(bulkAdds?.length ? bulkAdds : [addee])}
        {isTeam && ' to the team'}
        {role && ` as ${indefiniteArticle(role)} ${role}`}. {mc}
      </Kb.Text>
    </UserNotice>
  )
})

type Props = {
  addee: string
  role: T.Teams.MaybeTeamRoleType
  onManageNotifications: () => void
  onViewBot: () => void
  onViewTeam: () => void
  isTeam: boolean
  teamname: string
  timestamp: number
  you: string
  isAdmin: boolean
}

const isBot = (role: T.Teams.MaybeTeamRoleType) => {
  return role === 'bot' || role === 'restrictedbot'
}

const ManageComponent = (props: Props) => {
  const {role, isTeam, addee, you, onManageNotifications, onViewBot, isAdmin, onViewTeam} = props
  const textType = 'BodySmallSemiboldPrimaryLink'
  const bot = isBot(role)
  if (!isTeam && !bot) {
    return null
  }
  if (addee === you) {
    return (
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn}}>
        <Kb.Text onClick={onManageNotifications} type={textType}>
          Manage phone and computer notifications
        </Kb.Text>
      </Kb.Box>
    )
  } else if (bot) {
    return (
      <Kb.Text onClick={onViewBot} type={textType}>
        View bot settings
      </Kb.Text>
    )
  } else if (isAdmin) {
    return (
      <Kb.Text onClick={onViewTeam} type={textType}>
        Manage members
      </Kb.Text>
    )
  } else {
    return (
      <Kb.Text onClick={onViewTeam} type={textType}>
        See all members
      </Kb.Text>
    )
  }
}

const youOrUsername = (props: {username: string; you: string; capitalize: boolean; adder?: string}) => {
  if (props.adder === props.you) return 'yourself '
  if (props.username === props.you) {
    return props.capitalize ? 'You ' : 'you '
  }
  return ''
}

export default SystemAddedToTeamContainer
