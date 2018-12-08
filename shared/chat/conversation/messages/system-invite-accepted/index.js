// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {|
  message: Types.MessageSystemInviteAccepted,
  onViewTeam: () => void,
  teamname: string,
  you: string,
|}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
}

const InviteAddedToTeamNotice = (props: Props) => {
  if (props.you === props.message.invitee) {
    return <YouInviteAddedToTeamNotice {...props} />
  }
  const {inviter} = props.message
  // There's not a lot of space to explain the adder / inviter situation,
  // just pretend they were added by the inviter for now.
  return (
    <Kb.Text type="BodySmall">
      was added by{' '}
      {props.you === inviter ? (
        'you'
      ) : (
        <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[inviter]} />
      )}
      .
    </Kb.Text>
  )
}

const YouInviteAddedToTeamNotice = (props: Props) => {
  const {timestamp} = props.message
  const {teamname} = props

  const copy = (
    <Kb.Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
      Welcome to{' '}
      <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.black_60}}>
        {teamname}
      </Kb.Text>
      . Say hi!{' '}
      <Kb.EmojiIfExists
        style={{display: Styles.isMobile ? 'flex' : 'inline-block'}}
        emojiName=":wave:"
        size={14}
      />
    </Kb.Text>
  )

  return (
    <UserNotice
      style={{marginTop: Styles.globalMargins.small}}
      teamname={teamname}
      bgColor={Styles.globalColors.blue4}
      onClickAvatar={props.onViewTeam}
    >
      <Kb.Icon type="icon-team-sparkles-64-40" style={{height: 40, marginTop: -36, width: 64}} />
      <Kb.Text
        type="BodySmallSemibold"
        backgroundMode="Announcements"
        style={{color: Styles.globalColors.black_40}}
      >
        {formatTimeForMessages(timestamp)}
      </Kb.Text>
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>{copy}</Kb.Box>
    </UserNotice>
  )
}

export default InviteAddedToTeamNotice
