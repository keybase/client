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
          {you === author ? (
            <Text type="BodySmallSemibold" style={{color: globalColors.black_40}}>
              You
            </Text>
          ) : (
            <ConnectedUsernames
              inline={true}
              type="BodySmall"
              onUsernameClicked={onUsernameClicked}
              colorFollowing={true}
              underline={true}
              usernames={[author]}
            />
          )}{' '}
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
    )
  }
}

export default Joined
