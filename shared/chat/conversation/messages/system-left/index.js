// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Avatar, Box, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

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
      <Box
        style={{
          marginTop: 3,
          marginBottom: 3,
          marginLeft: globalMargins.tiny,
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <Avatar
          onClick={() => onUsernameClicked(author)}
          size={24}
          username={author}
          style={{marginRight: globalMargins.tiny}}
        />
        <Box style={globalStyles.flexBoxColumn}>
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
          <Text title={formatTimeForMessages(timestamp)} type="BodySmall">
            left {isBigTeam ? `#${channelname}` : teamname}.
          </Text>
        </Box>
      </Box>
    )
  }
}

export default Left
