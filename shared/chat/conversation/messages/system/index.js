// @flow
import * as React from 'react'
import {Box, Text, ConnectedUsernames, Icon} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import UserNotice from '../../notices/user-notice'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

import type {SystemMessage, AddedToTeamInfo} from '../../../../constants/types/chat'

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

export {AddedToTeamNotice}
