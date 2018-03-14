// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box, Text, ConnectedUsernames} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'
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
          // ...globalStyles.flexBoxColumn,
          // alignItems: 'center',
        }}
      >
        <Text type="BodySmallItalic">
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
      // <UserNotice style={{marginTop: globalMargins.small}} username={author} bgColor={globalColors.blue4}>
      //   <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      //     {formatTimeForMessages(timestamp)}
      //   </Text>
      //   <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      //     <ConnectedUsernames
      //       inline={true}
      //       type="BodySmallSemibold"
      //       onUsernameClicked={onUsernameClicked}
      //       colorFollowing={true}
      //       underline={true}
      //       usernames={[author]}
      //     />{' '}
      //     left
      //     {isBigTeam ? (
      //       `#${channelname}`
      //     ) : (
      //       <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
      //         {teamname}
      //       </Text>
      //     )}.
      //   </Text>
      // </UserNotice>
    )
  }
}

export default Left
