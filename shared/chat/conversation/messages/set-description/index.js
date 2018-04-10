// @flow
import * as React from 'react'
import {SmallUserNotice} from '../user-notice'
import {ConnectedUsernames, Text} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'

type Props = {
  author: string,
  description: ?string,
  onUsernameClicked: () => void,
  setUsernameBlack: boolean,
}

const SetDescription = (props: Props) => {
  return (
    <SmallUserNotice
      avatarUsername={props.author}
      onAvatarClicked={props.onUsernameClicked}
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
          {props.description ? 'set the channel description:' : 'cleared the channel description.'}
        </Text>
      }
      bottomLine={props.description ? <Text type="BodySmallItalic">{props.description}</Text> : null}
    />
  )
}

export default SetDescription
