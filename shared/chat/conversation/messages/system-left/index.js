// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Avatar, Box, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalMargins, globalStyles} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  channelname: string,
  isBigTeam: boolean,
  message: Types.MessageSystemLeft,
  onUsernameClicked: (username: string) => void,
  teamname: string,
}

class Left extends React.PureComponent<Props> {
  render() {
    const {channelname, isBigTeam, teamname, onUsernameClicked} = this.props
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
        <Avatar size={24} username={author} style={{marginRight: globalMargins.tiny}} />
        <Box style={globalStyles.flexBoxColumn}>
          <Text title={formatTimeForMessages(timestamp)} type="BodySmallSemibold">
            <ConnectedUsernames
              inline={true}
              type="BodySmallSemibold"
              onUsernameClicked={onUsernameClicked}
              colorFollowing={true}
              underline={true}
              usernames={[author]}
            />
          </Text>
          <Text type="BodySmallSemibold">left {isBigTeam ? `#${channelname}` : teamname}</Text>
        </Box>
      </Box>
    )
  }
}

export default Left
