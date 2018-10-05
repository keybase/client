// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice, {SmallUserNotice} from '../user-notice'
import {Text, ConnectedUsernames} from '../../../../common-adapters'
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
    if (author === you) {
      // Bring more attention to the current user joining
      return <JoinedUserNotice {...this.props} />
    }
    return (
      <SmallUserNotice
        avatarUsername={author}
        onAvatarClicked={() => onUsernameClicked(author)}
        title={formatTimeForMessages(timestamp)}
        topLine={
          <ConnectedUsernames
            inline={true}
            type="BodySmallSemibold"
            onUsernameClicked={onUsernameClicked}
            colorFollowing={true}
            underline={true}
            usernames={[author]}
          />
        }
        bottomLine={
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
        }
      />
    )
  }
}

class JoinedUserNotice extends React.PureComponent<Props> {
  render() {
    const {channelname, isBigTeam, onManageChannels, you, teamname, onUsernameClicked} = this.props
    const {author, timestamp} = this.props.message
    return (
      <UserNotice style={{marginTop: globalMargins.small}} username={author} bgColor={globalColors.blue4}>
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {formatTimeForMessages(timestamp)}
        </Text>
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {you === author ? (
            'You'
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
          joined{' '}
          {isBigTeam ? (
            `#${channelname}`
          ) : (
            <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
              {teamname}
            </Text>
          )}
          .
        </Text>
        {author === you &&
          isBigTeam && (
            <Text
              backgroundMode="Announcements"
              onClick={onManageChannels}
              style={{color: globalColors.blue}}
              type="BodySmallSemibold"
            >
              Manage channel subscriptions.
            </Text>
          )}
      </UserNotice>
    )
  }
}

export default Joined
