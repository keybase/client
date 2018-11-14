// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {SmallUserNotice} from '../user-notice'
import {Text, ConnectedUsernames, Box2} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'
import {formatTimeForMessages, formatTimeForChat} from '../../../../util/timestamp'

type Props = {
  channelname: string,
  isBigTeam: boolean,
  message: Types.MessageSystemLeft,
  onUsernameClicked: (username: string) => void,
  teamname: string,
  you: string,
}

class Left extends React.PureComponent<Props> {
  render() {
    const {channelname, isBigTeam, teamname, onUsernameClicked, you} = this.props
    const {author, timestamp} = this.props.message
    return (
      <SmallUserNotice
        avatarUsername={author}
        onAvatarClicked={() => onUsernameClicked(author)}
        title={formatTimeForMessages(timestamp)}
        topLine={
          <Box2 direction="horizontal" fullWidth={true} gap="xtiny">
            <Text type="BodySmallSemibold">
              {you === author ? (
                <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
                  You
                </Text>
              ) : (
                <ConnectedUsernames
                  inline={true}
                  type="BodySmallSemibold"
                  onUsernameClicked={onUsernameClicked}
                  colorFollowing={true}
                  underline={true}
                  usernames={[author]}
                />
              )}{' '}
            </Text>
            <Text type="BodyTiny">{formatTimeForChat(this.props.message.timestamp)}</Text>
          </Box2>
        }
        bottomLine={<Text type="BodySmall">left {isBigTeam ? `#${channelname}` : teamname}.</Text>}
      />
    )
  }
}

export default Left
