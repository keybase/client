// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {SmallUserNotice} from '../user-notice'

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
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (props.message.addee === props.you) {
    return (
      <Kb.Text onClick={props.onManageChannels} type={textType}>
        Manage your channel subscriptions
      </Kb.Text>
    )
  } else if (props.isAdmin) {
    return (
      <Kb.Text onClick={props.onViewTeam} type={textType}>
        Manage members
      </Kb.Text>
    )
  } else {
    return (
      <Kb.Text onClick={props.onViewTeam} type={textType}>
        See all members
      </Kb.Text>
    )
  }
}

const YouOrUsername = ({
  username,
  you,
  capitalize,
  adder,
}: {
  username: string,
  you: string,
  capitalize: boolean,
  adder?: string,
}) => {
  if (adder === you) return 'yourself'
  if (username === you) {
    return capitalize ? 'You' : 'you'
  }
  return <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[username]} />
}

const AddedToTeam = (props: Props) => {
  if (props.message.addee === props.you) {
    return <YouAddedToTeam {...props} />
  }
  return (
    <Kb.Text type="BodySmall" style={{flex: 1}}>
      was added by <YouOrUsername username={props.message.adder} you={props.you} capitalize={false} />.{' '}
      <ManageComponent {...props} />
    </Kb.Text>
  )
}

class YouAddedToTeam extends React.PureComponent<Props> {
  render() {
    const {adder, addee} = this.props.message
    const {teamname, you, onViewTeam} = this.props
    return (
      <Kb.Text
        type="BodySmallSemibold"
        backgroundMode="Announcements"
        style={{color: Styles.globalColors.black_40, textAlign: 'center', flex: 1}}
      >
        <YouOrUsername username={adder} you={you} capitalize={true} /> added{' '}
        <YouOrUsername username={addee} adder={adder} you={you} capitalize={false} /> to{' '}
        <Kb.Text
          onClick={onViewTeam}
          style={{color: Styles.globalColors.black_60}}
          type="BodySmallSemiboldSecondaryLink"
        >
          {teamname}
        </Kb.Text>
        .{' '}
        <Kb.Text type="BodySmallSemibold">
          Say hi!{' '}
          <Kb.EmojiIfExists
            style={Styles.isMobile ? {display: 'inline-block'} : null}
            emojiName=":wave:"
            size={14}
          />
        </Kb.Text>
        <ManageComponent {...this.props} />
      </Kb.Text>
    )
  }
}

export default AddedToTeam
