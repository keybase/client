// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice, {SmallUserNotice} from '../user-notice'
import {Box, Text, ConnectedUsernames, Icon, EmojiIfExists} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

type Props = {
  message: Types.MessageSystemInviteAccepted,
  onClickUserAvatar: (username: string) => void,
  onViewTeam: (team: string) => void,
  teamname: string,
  you: string,
}

const connectedUsernamesProps = {
  onUsernameClicked: 'profile',
  colorFollowing: true,
  inline: true,
  type: 'BodySmallSemibold',
  underline: true,
}

const InviteAddedToTeamNotice = (props: Props) => {
  if (props.you === props.message.invitee) {
    return <YouInviteAddedToTeamNotice {...props} />
  }
  const {invitee, inviter, timestamp} = props.message
  // There's not a lot of space to explain the adder / inviter situation,
  // just pretend they were added by the inviter for now.
  return (
    <SmallUserNotice
      avatarUsername={invitee}
      onAvatarClicked={() => props.onClickUserAvatar(invitee)}
      topLine={<ConnectedUsernames {...connectedUsernamesProps} usernames={[invitee]} />}
      title={formatTimeForMessages(timestamp)}
      bottomLine={
        <Text type="BodySmall">
          was added by{' '}
          {props.you === inviter ? (
            'you'
          ) : (
            <ConnectedUsernames {...connectedUsernamesProps} usernames={[inviter]} />
          )}
          .
        </Text>
      }
    />
  )
}

class YouInviteAddedToTeamNotice extends React.PureComponent<Props> {
  render() {
    const {timestamp} = this.props.message
    const {teamname} = this.props

    const copy = (
      <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
        Welcome to{' '}
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
          {teamname}
        </Text>
        . Say hi!{' '}
        <EmojiIfExists style={{display: isMobile ? 'flex' : 'inline-block'}} emojiName=":wave:" size={14} />
      </Text>
    )

    return (
      <UserNotice
        style={{marginTop: globalMargins.small}}
        teamname={teamname}
        bgColor={globalColors.blue4}
        onClickAvatar={() => this.props.onViewTeam(teamname)}
      >
        <Icon type="icon-team-sparkles-64-40" style={{height: 40, marginTop: -36, width: 64}} />
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {formatTimeForMessages(timestamp)}
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>{copy}</Box>
      </UserNotice>
    )
  }
}

export default InviteAddedToTeamNotice
