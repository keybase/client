// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../../notices/user-notice'
import {Box, Text, ConnectedUsernames, Icon} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

type Props = {
  message: Types.MessageSystemInviteAccepted,
  you: string,
}

const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  inline: true,
  type: 'BodySmallSemibold',
  underline: true,
}

class InviteAddedToTeamNotice extends React.PureComponent<Props> {
  render() {
    const {team, inviter, invitee, adder, inviteType, timestamp} = this.props.message
    const {you} = this.props

    const copy =
      you === invitee ? (
        <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
          Welcome to{' '}
          <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
            {team}
          </Text>
          . Say hi!{' '}
          <EmojiIfExists style={{display: isMobile ? 'flex' : 'inline-block'}} emojiName=":wave:" size={14} />
        </Text>
      ) : (
        <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
          <ConnectedUsernames {...connectedUsernamesProps} usernames={[invitee]} /> just joined {team}.{' '}
          {you === inviter ? 'You invited them' : 'They were invited by '}
          {you !== inviter && (
            <ConnectedUsernames {...connectedUsernamesProps} usernames={[inviter]} />
          )} via {inviteType}
          , and they were just now auto-added to the team sigchain by{' '}
          {you === adder ? 'you' : <ConnectedUsernames {...connectedUsernamesProps} usernames={[adder]} />}
          , the first available admin.
        </Text>
      )

    return (
      <UserNotice
        style={{marginTop: globalMargins.small}}
        username={invitee === you ? undefined : invitee}
        teamname={invitee === you ? team : undefined}
        bgColor={globalColors.blue4}
      >
        {you === invitee && (
          <Icon type="icon-team-sparkles-48-40" style={{height: 40, marginTop: -36, width: 48}} />
        )}
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {formatTimeForMessages(timestamp)}
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>{copy}</Box>
      </UserNotice>
    )
  }
}

export default InviteAddedToTeamNotice
