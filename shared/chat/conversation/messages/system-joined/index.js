// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Avatar, Box, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  channelname: string,
  isBigTeam: boolean,
  message: Types.MessageSystemJoined,
  onManageChannels: () => void,
  onUsernameClicked: (username: string) => void,
  teamname: string,
  you: string,
}

class Joined extends React.PureComponent<Props> {
  render() {
    const {channelname, isBigTeam, onManageChannels, you, teamname, onUsernameClicked} = this.props
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
          <Text title={formatTimeForMessages(timestamp)} type="BodySmallSemibold">
            {you === author ? (
              <Text type="BodySmallSemibold" style={{color: globalColors.black_40}}>
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
          <Text type="BodySmall">
            joined {isBigTeam ? `#${channelname}` : teamname}
            {'. '}
            {author === you &&
              isBigTeam && (
                <Text title="" onClick={onManageChannels} style={{color: globalColors.blue}} type="BodySmall">
                  Manage channel subscriptions.
                </Text>
              )}
          </Text>
        </Box>
      </Box>
    )
  }
}

export default Joined
