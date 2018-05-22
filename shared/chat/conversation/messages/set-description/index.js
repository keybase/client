// @flow
import * as React from 'react'
import {SmallUserNotice} from '../user-notice'
import {ConnectedUsernames, Text} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  author: string,
  description: ?string,
  onUsernameClicked: () => void,
  setUsernameBlack: boolean,
  timestamp: number,
}

const SetDescription = (props: Props) => {
  return (
    <SmallUserNotice
      avatarUsername={props.author}
      onAvatarClicked={props.onUsernameClicked}
      title={formatTimeForMessages(props.timestamp)}
      topLine={
        <Text type="BodySmall">
          <ConnectedUsernames
            inline={true}
            type="BodySmallSemibold"
            onUsernameClicked={props.onUsernameClicked}
            colorFollowing={true}
            underline={true}
            usernames={[props.author]}
            style={props.setUsernameBlack ? {color: globalColors.black_75} : undefined}
          />{' '}
        </Text>
      }
      bottomLine={
        props.description ? (
          <Text type="BodySmall">
            set the channel description: <Text type="BodySmallSemiboldItalic">{props.description}</Text>
          </Text>
        ) : (
          <Text type="BodySmall">cleared the channel description.</Text>
        )
      }
    />
  )
}

export default SetDescription
