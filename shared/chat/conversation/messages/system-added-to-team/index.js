// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../../notices/user-notice'
import {Box, Text, Icon, ConnectedUsernames} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import {globalStyles, globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {
  message: Types.MessageSystemAddedToTeam,
  onManageChannels: () => void,
  onViewTeam: () => void,
  you: string,
}

const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  inline: true,
  type: 'BodySmallSemibold',
  underline: true,
}

class AddedToTeam extends React.PureComponent<Props> {
  render() {
    const {adder, addee, team, timestamp, isAdmin} = this.props.message
    const {you, onManageChannels, onViewTeam} = this.props

    const adderComponent =
      adder === you ? 'You' : <ConnectedUsernames {...connectedUsernamesProps} usernames={[adder]} />

    const addeeComponent =
      addee === you ? 'you' : <ConnectedUsernames {...connectedUsernamesProps} usernames={[addee]} />

    let manageComponent = null

    if (addee === you) {
      manageComponent = (
        <Text
          onClick={onManageChannels}
          type="BodySmallSemiboldInlineLink"
          style={{color: globalColors.blue}}
        >
          Manage your channel subscriptions
        </Text>
      )
    } else if (isAdmin) {
      manageComponent = (
        <Text onClick={onViewTeam} type="BodySmallSemiboldInlineLink" style={{color: globalColors.blue}}>
          Manage members
        </Text>
      )
    } else {
      manageComponent = (
        <Text onClick={onViewTeam} type="BodySmallSemiboldInlineLink" style={{color: globalColors.blue}}>
          See all members
        </Text>
      )
    }

    return (
      <UserNotice
        style={{marginTop: globalMargins.small}}
        username={you !== addee ? addee : undefined}
        teamname={you === addee ? team : undefined}
        bgColor={globalColors.blue4}
      >
        {you === addee && (
          <Icon type="icon-team-sparkles-48-40" style={{height: 40, marginTop: -36, width: 48}} />
        )}
        <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
          {formatTimeForMessages(timestamp)}
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
          <Text
            type="BodySmallSemibold"
            backgroundMode="Announcements"
            style={{color: globalColors.black_40, textAlign: 'center'}}
          >
            {adderComponent} added {addeeComponent} to{' '}
            <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
              {team}
            </Text>
            .{' '}
            {you === addee && (
              <Text type="BodySmallSemibold">
                Say hi! <EmojiIfExists style={{display: 'inline-block'}} emojiName=":wave:" size={14} />
              </Text>
            )}
          </Text>
          {manageComponent}
        </Box>
      </UserNotice>
    )
  }
}

export default AddedToTeam
