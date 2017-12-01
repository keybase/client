// @flow
import * as React from 'react'
import {Box, Text, ConnectedUsernames, Icon} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import UserNotice from '../../notices/user-notice'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

import type {SystemMessage} from '../../../../constants/types/chat'

/**
 * TODO: Fix typing hhere
 * replace systemType with defined constants
 * maybe type each system message props separately
 * make a connected username component w/ auto coloring
 */

type Props = {
  channelname: string,
  message: SystemMessage,
  onManageChannels: (teamname: string) => void,
  onViewTeam: (teamname: string) => void,
  teamname: string,
  you: string,
}

const AddedToTeamNotice = ({channelname, message, onManageChannels, onViewTeam, you}: Props) => {
  let adder = ''
  let addee = ''
  let team = ''
  if (message.meta.systemType === 0 && message.meta.addedtoteam) {
    adder = message.meta.addedtoteam.adder
    addee = message.meta.addedtoteam.addee
    team = message.meta.addedtoteam.team
  }

  const adderComponent = adder === you
    ? 'You'
    : <ConnectedUsernames
        clickable={true}
        inline={true}
        type="BodySmallSemibold"
        colorFollowing={true}
        usernames={[adder]}
      />

  const addeeComponent = addee === you
    ? 'you'
    : <ConnectedUsernames
        clickable={true}
        inline={true}
        type="BodySmallSemibold"
        colorFollowing={true}
        usernames={[addee]}
      />

  let manageComponent = null
  if (adder === you) {
    manageComponent = (
      <Text
        onClick={() => onViewTeam(team)}
        type="BodySmallSemiboldInlineLink"
        style={{color: globalColors.blue}}
      >
        Manage members
      </Text>
    )
  } else if (addee === you) {
    manageComponent = (
      <Text
        onClick={() => onManageChannels(team)}
        type="BodySmallSemiboldInlineLink"
        style={{color: globalColors.blue}}
      >
        Manage your channel subscriptions
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
      <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
        {formatTimeForMessages(message.timestamp)}
      </Text>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {adderComponent}
          {' '}
          added
          {' '}
          {addeeComponent}
          {' '}
          to
          {' '}
          <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>{team}</Text>
          .
          {' '}
          {you === addee &&
            <Text type="BodySmallSemibold">
              Say hi!
              {' '}
              <EmojiIfExists style={{display: 'inline-block'}} emojiName=":wave:" size={14} />
            </Text>}
        </Text>
        {manageComponent}
      </Box>
    </UserNotice>
  )
}

const ComplexTeamNotice = ({channelname, message, onManageChannels, you}: Props) => {
  const teamname = message.meta.systemType === 2 && message.meta.complexteam && message.meta.complexteam.team
  const authorComponent = message.author === you
    ? 'You'
    : <ConnectedUsernames
        clickable={true}
        inline={true}
        type="BodySmallSemibold"
        colorFollowing={true}
        usernames={[message.author]}
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

const InviteAddedToTeamNotice = ({channelname, message, onManageChannels, you}: Props) => (
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
