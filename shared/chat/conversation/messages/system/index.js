// @flow
import * as React from 'react'
import {Box, Text, ConnectedUsernames, Icon, TimelineMarker} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import UserNotice from '../../notices/user-notice'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isAndroid, isMobile} from '../../../../constants/platform'

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
  underline: true,
}

type Props = {
  admin: boolean,
  channelname: string,
  isBigTeam: boolean,
  message: SystemMessage,
  onClickUserAvatar: (username: string) => void,
  onManageChannels: (teamname: string) => void,
  onViewTeam: (teamname: string) => void,
  onViewGitRepo: (repoID: string, teamname: string) => void,
  teamname: string,
  you: string,
}

type AddedToTeamProps = Props & {info: AddedToTeamInfo}

const AddedToTeamNotice = ({
  admin,
  channelname,
  isBigTeam,
  message,
  info,
  onClickUserAvatar,
  onManageChannels,
  onViewTeam,
  you,
}: AddedToTeamProps) => {
  const {adder, addee, team} = info

  const adderComponent =
    adder === you ? 'You' : <ConnectedUsernames {...connectedUsernamesProps} usernames={[adder]} />

  const selfAddee = adder === you ? 'yourself' : 'you'
  const addeeComponent =
    addee === you ? selfAddee : <ConnectedUsernames {...connectedUsernamesProps} usernames={[addee]} />

  let manageComponent = null

  if (addee === you && isBigTeam) {
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
      onClickAvatar={you !== addee ? () => onClickUserAvatar(addee) : () => onViewTeam(team)}
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
              Say hi!{' '}
              <EmojiIfExists
                style={{display: isMobile ? 'flex' : 'inline-block'}}
                emojiName=":wave:"
                size={14}
              />
            </Text>
          )}
        </Text>
        {manageComponent}
      </Box>
    </UserNotice>
  )
}

type ComplexTeamProps = Props & {info: SimpleToComplexTeamInfo}

const ComplexTeamNotice = ({
  channelname,
  message,
  info,
  onManageChannels,
  onViewTeam,
  you,
}: ComplexTeamProps) => {
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
      onClickAvatar={() => onViewTeam(teamname)}
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
            {!isAndroid && (
              <Text type="BodySmallSemibold">
                Notifications will no longer happen for every message. {isMobile ? 'Tap' : 'Click on'} the{' '}
                <Box style={{display: isMobile ? 'flex' : 'inline-block', height: 11, width: 11}}>
                  <Icon type="iconfont-info" style={{fontSize: 11}} />
                </Box>{' '}
                to configure them.
              </Text>
            )}
            {isAndroid && (
              <Text type="BodySmallSemibold">
                Notifications will no longer happen for every message. Tap the info icon in the top right to
                configure them.
              </Text>
            )}
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
  onClickUserAvatar,
  onManageChannels,
  onViewTeam,
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
      onClickAvatar={invitee === you ? () => onViewTeam(team) : () => onClickUserAvatar(invitee)}
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

const GitPushInfoNotice = ({message, info, onClickUserAvatar, onViewGitRepo}: GitPushInfoProps) => {
  // There is a bug in the data layer where mergeEntities when it sees dupes of this message will keep on adding to the array
  // Short term fix: clean this up

  const refsMap = (info.refs || []).reduce((map, ref) => {
    ;(ref.commits || []).forEach(commit => {
      const name = ref.refName.split('/')[2]
      if (!map[name]) {
        map[name] = []
      }
      if (!map[name].find(c => c.commitHash === commit.commitHash)) {
        map[name].push(commit)
      }
    })
    return map
  }, {})

  return Object.keys(refsMap).map(branchName => (
    <UserNotice
      username={info.pusher}
      key={branchName}
      style={{marginTop: globalMargins.small}}
      bgColor={globalColors.blue4}
      onClickAvatar={() => onClickUserAvatar(info.pusher)}
    >
      <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
        {formatTimeForMessages(message.timestamp)}
      </Text>
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="BodySmallSemibold" style={{textAlign: 'center', marginBottom: globalMargins.xtiny}}>
          <ConnectedUsernames {...connectedUsernamesProps} usernames={[info.pusher]} /> pushed{' '}
          {refsMap[branchName].length} {`commit${refsMap[branchName].length !== 1 ? 's' : ''}`} to{' '}
          <Text
            type="BodySmallSemibold"
            style={info.repoID ? {color: globalColors.black_75} : undefined}
            onClick={info.repoID ? () => onViewGitRepo(info.repoID, info.team) : undefined}
          >{`${info.repo}/${branchName}`}</Text>:
        </Text>
        <Box style={globalStyles.flexBoxColumn}>
          {refsMap[branchName].map((commit, i) => (
            <Box style={globalStyles.flexBoxRow} key={commit.commitHash}>
              <TimelineMarker
                idx={i}
                max={refsMap[branchName].length - 1}
                style={{marginRight: globalMargins.xtiny, ...(isMobile ? {marginTop: -3} : null)}}
              />
              <Box style={{...globalStyles.flexBoxRow, flex: 1, alignItems: 'flex-start'}}>
                <Box
                  style={{
                    display: 'flex',
                    backgroundColor: globalColors.blue3_20,
                    padding: 2,
                    borderRadius: 3,
                    marginRight: globalMargins.xtiny,
                    marginBottom: 1,
                    height: 18,
                  }}
                >
                  <Text
                    type="Terminal"
                    style={{
                      ...globalStyles.selectable,
                      fontSize: 11,
                      color: globalColors.blue,
                      lineHeight: isMobile ? 16 : 1.3,
                    }}
                  >
                    {commit.commitHash.substr(0, 8)}
                  </Text>
                </Box>
                <Box style={{display: 'flex', flex: 1}}>
                  <Text
                    type="BodySmall"
                    style={{...globalStyles.selectable, textAlign: 'left'}}
                    lineClamp={2}
                  >
                    {commit.message}
                  </Text>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </UserNotice>
  ))
}

export {AddedToTeamNotice, ComplexTeamNotice, InviteAddedToTeamNotice, GitPushInfoNotice}
