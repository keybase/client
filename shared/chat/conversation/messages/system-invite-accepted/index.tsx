import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as TeamTypes from '../../../../constants/types/teams'
import UserNotice from '../user-notice'
import {typeToLabel} from '../../../../constants/teams'

type Props = {
  message: Types.MessageSystemInviteAccepted
  onViewTeam: () => void
  role: TeamTypes.MaybeTeamRoleType
  teamname: string
  you: string
}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
} as const

const InviteAddedToTeamNotice = (props: Props) => {
  if (props.you === props.message.invitee) {
    return <YouInviteAddedToTeamNotice {...props} />
  }
  const {inviter} = props.message
  // There's not a lot of space to explain the adder / inviter situation,
  // just pretend they were added by the inviter for now.
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        was added by{' '}
        {props.you === inviter ? (
          'you'
        ) : (
          <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[inviter]} />
        )}
        {typeToLabel[props.role] && ` as a "${typeToLabel[props.role].toLowerCase()}"`}.{' '}
      </Kb.Text>
    </UserNotice>
  )
}

const YouInviteAddedToTeamNotice = (props: Props) => {
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">You joined the team.</Kb.Text>
      <Kb.Text type="BodySmallPrimaryLink" onClick={props.onViewTeam}>
        View all members
      </Kb.Text>
    </UserNotice>
  )
}

export default InviteAddedToTeamNotice
