// @flow
import * as React from 'react'
import {Box, Text, ConnectedUsernames, Icon} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import UserNotice from '../../notices/user-notice'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

import type {
  SystemMessage,
  AddedToTeamInfo,
  SimpleToComplexTeamInfo,
  InviteAcceptedInfo,
  GitPushInfo,
} from '../../../../constants/types/chat'

const connectedUsernamesProps = {
  clickable: true,
  inline: true,
  colorFollowing: true,
  type: 'BodySmallSemibold',
}

type Props = {
  admin: boolean,
  channelname: string,
  message: SystemMessage,
  onManageChannels: (teamname: string) => void,
  onViewTeam: (teamname: string) => void,
  teamname: string,
  you: string,
}

type AddedToTeamProps = Props & {info: AddedToTeamInfo}

const AddedToTeamNotice = ({
  admin,
  channelname,
  message,
  info,
  onManageChannels,
  onViewTeam,
  you,
}: AddedToTeamProps) => {
  const {adder, addee, team} = info

  const adderComponent =
    adder === you ? 'You' : <ConnectedUsernames {...connectedUsernamesProps} usernames={[adder]} />

  const addeeComponent =
    addee === you ? 'you' : <ConnectedUsernames {...connectedUsernamesProps} usernames={[addee]} />

  let manageComponent = null

  if (addee === you) {
    manageComponent = (
      <Text
        onClick={() => onManageChannels(team)}
        type="BodySmallSemiboldInlineLink"
        style={{color: globalColors.blue}}
      >
        Manage your channel subscriptions
      </Text>
    )
  } else if (admin) {
    manageComponent = (
      <Text
        onClick={() => onViewTeam(team)}
        type="BodySmallSemiboldInlineLink"
        style={{color: globalColors.blue}}
      >
        Manage members
      </Text>
    )
  } else {
    manageComponent = (
      <Text
        onClick={() => onViewTeam(team)}
        type="BodySmallSemiboldInlineLink"
        style={{color: globalColors.blue}}
      >
        See all members
      </Text>
    )
  }

  return (
    <UserNotice
      style={{marginTop: globalMargins.small}}
      username={you !== addee ? addee : undefined}
      teamname={you === addee ? team : undefined}
      bgColor={globalColors.blue4}
    >
      {you === addee && (
        <Icon type="icon-team-sparkles-48-40" style={{marginTop: -36, width: 48, height: 40}} />
      )}
      <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
        {formatTimeForMessages(message.timestamp)}
      </Text>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Text
          type="BodySmallSemibold"
          backgroundMode="Announcements"
          style={{color: globalColors.black_40, textAlign: 'center'}}
        >
          {adderComponent} added {addeeComponent} to{' '}
          <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
            {team}
          </Text>
          .{' '}
          {you === addee && (
            <Text type="BodySmallSemibold">
              Say hi! <EmojiIfExists style={{display: 'inline-block'}} emojiName=":wave:" size={14} />
            </Text>
          )}
        </Text>
        {manageComponent}
      </Box>
    </UserNotice>
  )
}

type ComplexTeamProps = Props & {info: SimpleToComplexTeamInfo}

const ComplexTeamNotice = ({channelname, message, info, onManageChannels, you}: ComplexTeamProps) => {
  const teamname = info.team
  const authorComponent =
    message.author === you ? (
      'You'
    ) : (
      <ConnectedUsernames
        clickable={true}
        inline={true}
        type="BodySmallSemibold"
        colorFollowing={true}
        usernames={[message.author]}
      />
    )
  return (
    <UserNotice
      style={{marginTop: globalMargins.small}}
      teamname={teamname || ''}
      bgColor={globalColors.blue4}
    >
      <Text
        type="BodySmallSemibold"
        backgroundMode="Announcements"
        style={{color: globalColors.black_40, marginTop: globalMargins.tiny}}
      >
        {formatTimeForMessages(message.timestamp)}
      </Text>
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
          {authorComponent} made {teamname} a big team!
        </Text>
        <Text type="BodySmallSemibold" style={{textAlign: 'center', marginTop: globalMargins.tiny}}>
          Note that:
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, marginTop: globalMargins.xtiny}}>
          <Box style={{...globalStyles.flexBoxRow}}>
            <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
              {'\u2022'}
            </Text>
            <Text type="BodySmallSemibold">
              Your team channels will now appear in the "Big teams" section of the inbox.
            </Text>
          </Box>
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
              {'\u2022'}
            </Text>
            <Text type="BodySmallSemibold">
              Notifications will no longer happen for every message. {isMobile ? 'Tap' : 'Click on'} the{' '}
              <Box style={{display: 'inline-block'}}>
                <Icon type="iconfont-info" style={{fontSize: 11}} />
              </Box>{' '}
              to configure them.
            </Text>
          </Box>
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
              {'\u2022'}
            </Text>
            <Text type="BodySmallSemibold">
              Everyone can now create and join channels.{' '}
              <Text
                onClick={() => onManageChannels(teamname || '')}
                type="BodySmallSemiboldInlineLink"
                style={{color: globalColors.blue}}
              >
                Manage your channel subscriptions
              </Text>
            </Text>
          </Box>
        </Box>
      </Box>
    </UserNotice>
  )
}

type InviteAddedToTeamProps = Props & {info: InviteAcceptedInfo}

const InviteAddedToTeamNotice = ({
  channelname,
  message,
  info,
  onManageChannels,
  you,
}: InviteAddedToTeamProps) => {
  const {team, inviter, invitee, adder, inviteType} = info

  let copy
  if (you === invitee) {
    copy = (
      <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
        Welcome to{' '}
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
          {team}
        </Text>
        . Say hi!{' '}
        <EmojiIfExists style={{display: isMobile ? 'flex' : 'inline-block'}} emojiName=":wave:" size={14} />
      </Text>
    )
  } else {
    copy = (
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
  }

  return (
    <UserNotice
      style={{marginTop: globalMargins.small}}
      username={invitee === you ? undefined : invitee}
      teamname={invitee === you ? team : undefined}
      bgColor={globalColors.blue4}
    >
      {you === invitee && (
        <Icon type="icon-team-sparkles-48-40" style={{marginTop: -36, width: 48, height: 40}} />
      )}
      <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
        {formatTimeForMessages(message.timestamp)}
      </Text>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>{copy}</Box>
    </UserNotice>
  )
}

type GitPushInfoProps = Props & {info: GitPushInfo}

const GitPushInfoNotice = ({message, info}: GitPushInfoProps) => {
  return (
    <UserNotice teamname={info.team} style={{marginTop: globalMargins.small}} bgColor={globalColors.blue4}>
      <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
        {formatTimeForMessages(message.timestamp)}
      </Text>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
          {info.pusher} just pushed commits to the {info.repo} repo.
        </Text>
          {info.refs ? info.refs.map(ref => (
            <Box style={globalStyles.flexBoxColumn}>
              <Text type="Header" style={{textAlign: 'left'}}>
                {ref.refName}
              </Text>
              {ref.commits.map(commit =>
                  <Text type="BodySmall" style={{textAlign: 'left'}}>
                    {commit.commitHash} {commit.message}
                  </Text>)
              }
            </Box>)
          ) : '' }
      </Box>
    </UserNotice>
  )
}

export {AddedToTeamNotice, ComplexTeamNotice, InviteAddedToTeamNotice, GitPushInfoNotice}
