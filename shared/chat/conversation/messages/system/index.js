// @flow
import * as React from 'react'
import {Box, Text, Usernames, Icon} from '../../../../common-adapters'
import UserNotice from '../../notices/user-notice'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

import type {SystemMessage} from '../../../../constants/types/chat'

type Props = {
  channelname: string,
  message: SystemMessage,
  onManageChannels: () => void,
  onUsernameClicked: (username: string) => void,
  teamname: string,
  following: boolean,
  you: string,
}

const AddedToTeamNotice = ({
  channelname,
  message,
  onManageChannels,
  you,
  following,
  onUsernameClicked,
}: Props) => (
  <UserNotice style={{marginTop: globalMargins.small}} username={message.author} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {formatTimeForMessages(message.timestamp)}
    </Text>
    <Box style={globalStyles.flexBoxColumn}>
      {message.message.stringValue().split('\n').map((line, index) => (
        <Text
          key={index}
          type="BodySmallSemibold"
          backgroundMode="Announcements"
          style={{color: globalColors.black_40}}
        >
          {line}
        </Text>
      ))}
    </Box>
  </UserNotice>
)

const ComplexTeamNotice = ({
  channelname,
  message,
  onManageChannels,
  you,
  following,
  onUsernameClicked,
}: Props) => {
  const teamname = message.meta.systemType === 2 && message.meta.complexteam && message.meta.complexteam.team
  const authorComponent = message.author === you
    ? 'You'
    : <Usernames
        inline={true}
        type="BodySmallSemibold"
        colorFollowing={true}
        users={[{following, username: message.author}]}
      />
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
            <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>{'\u2022'}</Text>
            <Text type="BodySmallSemibold">
              Your team channels will now appear in the "Big teams" section of the inbox.
            </Text>
          </Box>
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>{'\u2022'}</Text>
            <Text type="BodySmallSemibold">
              Notifications will no longer happen for every message.
              {' '}
              {isMobile ? 'Tap' : 'Click on'}
              {' '}
              the
              {' '}
              <Box style={{display: 'inline-block'}}>
                <Icon type="iconfont-info" style={{fontSize: 11}} />
              </Box>
              {' '}
              to configure them.
            </Text>
          </Box>
          <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
            <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>{'\u2022'}</Text>
            <Text type="BodySmallSemibold">
              Everyone can now create and join channels.
              {' '}
              <Text
                onClick={onManageChannels}
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

const InviteAddedToTeamNotice = ({
  channelname,
  message,
  onManageChannels,
  you,
  following,
  onUsernameClicked,
}: Props) => (
  <UserNotice style={{marginTop: globalMargins.small}} username={message.author} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {formatTimeForMessages(message.timestamp)}
    </Text>
    <Box style={globalStyles.flexBoxColumn}>
      {message.message.stringValue().split('\n').map((line, index) => (
        <Text
          key={index}
          type="BodySmallSemibold"
          backgroundMode="Announcements"
          style={{color: globalColors.black_40}}
        >
          {line}
        </Text>
      ))}
    </Box>
  </UserNotice>
)

export {AddedToTeamNotice, ComplexTeamNotice, InviteAddedToTeamNotice}
