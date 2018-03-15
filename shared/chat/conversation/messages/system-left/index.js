// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalMargins} from '../../../../styles'
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
          marginLeft: globalMargins.xtiny,
          marginTop: 2,
          marginBottom: 2,
        }}
      >
        <Text title={formatTimeForMessages(timestamp)} type="BodySmallItalic">
          <ConnectedUsernames
            inline={true}
            type="BodySmallItalic"
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
