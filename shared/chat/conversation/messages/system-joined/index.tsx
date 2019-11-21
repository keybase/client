import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'
type Props = {
  author: string
  authorIsYou: boolean
  channelname: string
  isBigTeam: boolean
  joiners: Array<string>
  leavers: Array<string>
  onManageChannels: () => void
  onManageNotifications: () => void
  teamname: string
}

const textType = 'BodySmallSemiboldPrimaryLink'

const Joined = (props: Props) => <JoinedUserNotice {...props} />
// Bring more attention to the current user joining
// props.joiners.length < 1 ? (
//   <JoinedUserNotice {...props} />
// ) : (
//     <Kb.Box2 direction="vertical" fullWidth={true}>
//       <Kb.Text type="BodySmall">
//         {props.joiners.length > 0 && getAddedUsernames(props.joiners)}
//         {props.joiners.length > 0 &&
//           ` joined ${props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`}`}
//       </Kb.Text>
//     </Kb.Box2>
//   )

const JoinedUserNotice = (props: Props) => (
  <UserNotice>
    <Kb.Text type="BodySmall">
      {props.authorIsYou ? 'You ' : ''}
      {props.leavers.length > props.joiners.length ? 'left' : 'joined'}{' '}
      {props.isBigTeam ? `#${props.channelname}` : 'the team'}.
    </Kb.Text>
    {props.authorIsYou && props.isBigTeam && (
      <Kb.Text type="BodySmall">
        <Kb.Text onClick={props.onManageNotifications} type={textType} center={true}>
          Manage your notifications
        </Kb.Text>
        {` or `}
        <Kb.Text onClick={props.onManageChannels} type={textType}>
          browse other channels
        </Kb.Text>
        .
      </Kb.Text>
    )}
  </UserNotice>
)

export default Joined
