import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'

type OwnProps = {message: T.Chat.MessageSystemInviteAccepted}

const SystemInviteAcceptedContainer = React.memo(function SystemInviteAcceptedContainer(p: OwnProps) {
  const {message} = p
  const {role} = message
  const teamID = C.useChatContext(s => s.meta.teamID)
  const you = C.useCurrentUserState(s => s.username)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onViewTeam = React.useCallback(() => {
    navigateAppend({props: {teamID}, selected: 'team'})
  }, [navigateAppend, teamID])

  if (you === message.invitee) {
    return <YouInviteAddedToTeamNotice onViewTeam={onViewTeam} />
  }
  const {inviter} = message
  const roleLabel = role === 'none' ? null : C.Teams.typeToLabel[role]
  // There's not a lot of space to explain the adder / inviter situation,
  // just pretend they were added by the inviter for now.
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        was added by{' '}
        {you === inviter ? (
          'you'
        ) : (
          <Kb.ConnectedUsernames
            colorFollowing={true}
            inline={true}
            onUsernameClicked={'profile'}
            type={'BodySmallBold'}
            underline={true}
            usernames={inviter}
          />
        )}
        {roleLabel && ` as a "${roleLabel.toLowerCase()}"`}.{' '}
      </Kb.Text>
    </UserNotice>
  )
})

const YouInviteAddedToTeamNotice = (props: {onViewTeam: () => void}) => {
  const {onViewTeam} = props
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">You joined the team.</Kb.Text>
      <Kb.Text type="BodySmallPrimaryLink" onClick={onViewTeam}>
        View all members
      </Kb.Text>
    </UserNotice>
  )
}

export default SystemInviteAcceptedContainer
