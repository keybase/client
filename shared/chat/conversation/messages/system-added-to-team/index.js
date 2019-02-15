// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {|
  isAdmin: boolean,
  addee: string,
  adder: string,
  onManageChannels: () => void,
  onViewTeam: () => void,
  teamname: string,
  timestamp: number,
  you: string,
|}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
}

const ManageComponent = (props: Props) => {
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (props.addee === props.you) {
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

const YouOrUsername = (props: {username: string, you: string, capitalize: boolean, adder?: string}) => {
  if (props.adder === props.you) return 'yourself'
  if (props.username === props.you) {
    return props.capitalize ? 'You' : 'you'
  }
  return <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[props.username]} />
}

const AddedToTeam = (props: Props) => {
  if (props.addee === props.you) {
    return <YouAddedToTeam {...props} />
  }
  return (
    <Kb.Text type="BodySmall" style={{flex: 1}}>
      was added by <YouOrUsername username={props.adder} you={props.you} capitalize={false} />.{' '}
      <ManageComponent {...props} />
    </Kb.Text>
  )
}

const YouAddedToTeam = (props: Props) => {
  const {teamname, you, onViewTeam, adder, addee} = props
  return (
    <UserNotice
      style={{marginTop: Styles.globalMargins.small}}
      teamname={teamname}
      bgColor={Styles.globalColors.blue4}
      onClickAvatar={onViewTeam}
    >
      <Kb.Icon type="icon-team-sparkles-64-40" style={{height: 40, marginTop: -36, width: 64}} />
      <Kb.Text
        type="BodySmallSemibold"
        backgroundMode="Announcements"
        style={{color: Styles.globalColors.black_50}}
      >
        {formatTimeForMessages(props.timestamp)}
      </Kb.Text>
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.Text
          type="BodySmallSemibold"
          center={true}
          backgroundMode="Announcements"
          style={{color: Styles.globalColors.black_50}}
        >
          <YouOrUsername username={adder} you={you} capitalize={true} /> added{' '}
          <YouOrUsername username={addee} adder={adder} you={you} capitalize={false} /> to{' '}
          <Kb.Text
            onClick={onViewTeam}
            style={{color: Styles.globalColors.black_50}}
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
        </Kb.Text>
        <ManageComponent {...props} />
      </Kb.Box>
    </UserNotice>
  )
}

export default AddedToTeam
