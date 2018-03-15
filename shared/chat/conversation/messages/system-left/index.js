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
          marginTop: 2,
          marginBottom: 2,
          marginLeft: globalMargins.xtiny,
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <Avatar size={12} username={author} style={{marginRight: globalMargins.xtiny}} />
        <Text title={formatTimeForMessages(timestamp)} type="BodySmall">
          <ConnectedUsernames
            inline={true}
            type="BodySmall"
            onUsernameClicked={onUsernameClicked}
            colorFollowing={true}
            underline={true}
            usernames={[author]}
          />{' '}
          left {isBigTeam ? `#${channelname}` : teamname}
        </Text>
      </Box>
    )
  }
}

export default Left
