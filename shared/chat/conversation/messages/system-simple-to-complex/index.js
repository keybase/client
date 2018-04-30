// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../user-notice'
import {Box, Text, ConnectedUsernames, Icon} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isAndroid} from '../../../../constants/platform'

type Props = {
  message: Types.MessageSystemSimpleToComplex,
  onManageChannels: () => void,
  onViewTeam: (teamname: string) => void,
  you: string,
}

const bullet = '\u2022'

class ComplexTeamNotice extends React.PureComponent<Props> {
  render() {
    const {team, author, timestamp} = this.props.message
    const {you, onManageChannels, onViewTeam} = this.props
    const authorComponent =
      author === you ? (
        'You'
      ) : (
        <ConnectedUsernames
          clickable={true}
          inline={true}
          type="BodySmallSemibold"
          colorFollowing={true}
          underline={true}
          usernames={[author]}
        />
      )
    return (
      <UserNotice
        style={{marginTop: globalMargins.small}}
        teamname={team || ''}
        bgColor={globalColors.blue4}
        onClickAvatar={() => onViewTeam(team)}
      >
        <Text
          type="BodySmallSemibold"
          backgroundMode="Announcements"
          style={{color: globalColors.black_40, marginTop: globalMargins.tiny}}
        >
          {formatTimeForMessages(timestamp)}
        </Text>
        <Box style={globalStyles.flexBoxColumn}>
          <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
            {authorComponent} made {team} a big team!
          </Text>
          <Text type="BodySmallSemibold" style={{marginTop: globalMargins.tiny, textAlign: 'center'}}>
            Note that:
          </Text>
          <Box style={{...globalStyles.flexBoxColumn, marginTop: globalMargins.xtiny}}>
            <Box style={{...globalStyles.flexBoxRow}}>
              <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
                {bullet}
              </Text>
              <Text type="BodySmallSemibold">
                Your team channels will now appear in the "Big teams" section of the inbox.
              </Text>
            </Box>
            <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
              <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
                {bullet}
              </Text>
              {isAndroid ? (
                <Text type="BodySmallSemibold">
                  Notifications will no longer happen for every message. Tap the info icon in the top right to
                  configure them.
                </Text>
              ) : (
                <Text type="BodySmallSemibold">
                  Notifications will no longer happen for every message. {isMobile ? 'Tap' : 'Click on'} the{' '}
                  <Box style={{display: isMobile ? 'flex' : 'inline-block', height: 11, width: 11}}>
                    <Icon type="iconfont-info" fontSize={11} />
                  </Box>{' '}
                  to configure them.
                </Text>
              )}
            </Box>
            <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.tiny}}>
              <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
                {bullet}
              </Text>
              <Text type="BodySmallSemibold">
                Everyone can now create and join channels.{' '}
                <Text
                  onClick={onManageChannels}
                  type="BodySmallSemiboldInlineLink"
                  style={{color: globalColors.blue}}
                >
                  Manage your channel subscriptions
                </Text>
              </Text>
            </Box>
          </Box>
        </Box>
      </UserNotice>
    )
  }
}

export default ComplexTeamNotice
