// @flow
import * as React from 'react'
import {SmallUserNotice} from '../user-notice'
import {ConnectedUsernames, Text} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  author: string,
  channelname: ?string,
  onUsernameClicked: () => void,
  setUsernameBlack: boolean,
  timestamp: number,
}

const SetChannelname = (props: Props) => {
  return (
    <SmallUserNotice
      avatarUsername={props.author}
      onAvatarClicked={props.onUsernameClicked}
      title={formatTimeForMessages(props.timestamp)}
      topLine={
        <ConnectedUsernames
          inline={true}
          type="BodySmallSemibold"
          onUsernameClicked={props.onUsernameClicked}
          colorFollowing={true}
          underline={true}
          usernames={[props.author]}
          style={props.setUsernameBlack ? {color: globalColors.black_75} : undefined}
        />
      }
      bottomLine={
        <Text type="BodySmall">
          set the channel name to <Text type="BodySmallItalic">#{props.channelname}</Text>
        </Text>
      }
    />
  )
}

export default SetChannelname
