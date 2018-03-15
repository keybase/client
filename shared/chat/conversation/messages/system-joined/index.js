// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Text, ConnectedUsernames} from '../../../../common-adapters'
import {globalColors, globalMargins} from '../../../../styles'
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
          marginLeft: globalMargins.xtiny,
          marginTop: 2,
          marginBottom: 2,
        }}
      >
        <Text title={formatTimeForMessages(timestamp)} type="BodySmallItalic">
          {you === author ? (
            <Text type="BodySmallSemiboldItalic" style={{color: globalColors.black_40}}>
              You
            </Text>
          ) : (
            <ConnectedUsernames
              inline={true}
              type="BodySmallItalic"
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
              <Text
                title=""
                onClick={onManageChannels}
                style={{color: globalColors.blue}}
                type="BodySmallItalic"
              >
                Manage channel subscriptions.
              </Text>
            )}
        </Text>
      </Box>
    )
  }
}

export default Joined
