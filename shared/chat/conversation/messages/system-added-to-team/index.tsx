import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import SystemMessageTimestamp from '../system-message-timestamp'

type Props = {
  isAdmin: boolean
  addee: string
  adder: string
  onManageChannels: () => void
  onManageNotifications: () => void
  onViewTeam: () => void
  teamname: string
  timestamp: number
  you: string
}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
} as const

const ManageComponent = (props: Props) => {
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (props.addee === props.you) {
    return (
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.Text onClick={props.onManageNotifications} type={textType} center={true}>
          Manage phone and computer notifications
        </Kb.Text>
        <Kb.Text onClick={props.onManageChannels} type={textType}>
          Browse other channels
        </Kb.Text>
      </Kb.Box>
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

const youOrUsername = (props: {username: string; you: string; capitalize: boolean; adder?: string}) => {
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
      was added by {youOrUsername({capitalize: false, username: props.adder, you: props.you})}.{' '}
      <ManageComponent {...props} />
    </Kb.Text>
  )
}

const YouAddedToTeam = (props: Props) => {
  const {teamname, you, onViewTeam, adder, addee, timestamp} = props
  return (
    <UserNotice
      style={{marginTop: Styles.globalMargins.small}}
      teamname={teamname}
      bgColor={Styles.globalColors.blueLighter2}
      onClickAvatar={onViewTeam}
    >
      <Kb.Icon type="icon-team-sparkles-64-40" style={{height: 40, marginTop: -36, width: 64}} />
      <SystemMessageTimestamp timestamp={timestamp} />
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.Text
          type="BodySmallSemibold"
          center={true}
          negative={true}
          style={{color: Styles.globalColors.black_50}}
        >
          {youOrUsername({capitalize: true, username: adder, you})} added{' '}
          {youOrUsername({adder, capitalize: false, username: addee, you})} to{' '}
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
