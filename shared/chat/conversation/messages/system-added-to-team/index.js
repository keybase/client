// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice, {SmallUserNotice} from '../user-notice'
import {Box, Text, Icon, ConnectedUsernames} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  isAdmin: boolean,
  message: Types.MessageSystemAddedToTeam,
  onClickUserAvatar: (username: string) => void,
  onManageChannels: () => void,
  onViewTeam: () => void,
  teamname: string,
  you: string,
}

const connectedUsernamesProps = {
  onUsernameClicked: 'profile',
  colorFollowing: true,
  inline: true,
  type: 'BodySmallSemibold',
  underline: true,
}

const ManageComponent = (props: Props) => {
  const textType = props.message.addee === props.you ? 'BodySmallSemiboldSecondaryLink' : 'BodySmall'
  if (props.message.addee === props.you) {
    return (
      <Text onClick={props.onManageChannels} type={textType} style={{color: globalColors.blue}}>
        Manage your channel subscriptions
      </Text>
    )
  } else if (props.isAdmin) {
    return (
      <Text onClick={props.onViewTeam} type={textType} style={{color: globalColors.blue}}>
        Manage members
      </Text>
    )
  } else {
    return (
      <Text onClick={props.onViewTeam} type={textType} style={{color: globalColors.blue}}>
        See all members
      </Text>
    )
  }
}

const YouOrUsername = ({username, you, capitalize}: {username: string, you: string, capitalize: boolean}) => {
  if (username === you) {
    return capitalize ? 'You' : 'you'
  }
  return <ConnectedUsernames {...connectedUsernamesProps} usernames={[username]} />
}

const AddedToTeam = (props: Props) => {
  if (props.message.addee === props.you) {
    return <YouAddedToTeam {...props} />
  }
  return (
    <SmallUserNotice
      avatarUsername={props.message.addee}
      onAvatarClicked={() => props.onClickUserAvatar(props.message.addee)}
      topLine={<ConnectedUsernames {...connectedUsernamesProps} usernames={[props.message.addee]} />}
      title={formatTimeForMessages(props.message.timestamp)}
      bottomLine={
        <Text type="BodySmall">
          was added by <YouOrUsername username={props.message.adder} you={props.you} capitalize={false} />.{' '}
          <ManageComponent {...props} />
        </Text>
      }
    />
  )
}

class YouAddedToTeam extends React.PureComponent<Props> {
  render() {
    const {adder, addee, timestamp} = this.props.message
    const {teamname, you, onViewTeam} = this.props

    return (
      <UserNotice
        style={{marginTop: globalMargins.small}}
        teamname={teamname}
        bgColor={globalColors.blue4}
        onClickAvatar={onViewTeam}
      >
        <Icon type="icon-team-sparkles-64-40" style={{height: 40, marginTop: -36, width: 64}} />
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {formatTimeForMessages(timestamp)}
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
          <Text
            type="BodySmallSemibold"
            backgroundMode="Announcements"
            style={{color: globalColors.black_40, textAlign: 'center'}}
          >
            <YouOrUsername username={adder} you={you} capitalize={true} /> added{' '}
            <YouOrUsername username={addee} you={you} capitalize={false} /> to{' '}
            <Text
              onClick={onViewTeam}
              style={{color: globalColors.black_60}}
              type="BodySmallSemiboldSecondaryLink"
            >
              {teamname}
            </Text>
            .{' '}
            <Text type="BodySmallSemibold">
              Say hi!{' '}
              <EmojiIfExists
                style={isMobile ? {display: 'inline-block'} : null}
                emojiName=":wave:"
                size={14}
              />
            </Text>
          </Text>
          <ManageComponent {...this.props} />
        </Box>
      </UserNotice>
    )
  }
}

export default AddedToTeam
