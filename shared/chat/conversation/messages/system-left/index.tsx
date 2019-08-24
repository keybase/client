import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import {formatTimeForChat} from '../../../../util/timestamp'

type Props = {
  channelname: string
  isBigTeam: boolean
  leavers: Array<string>
  teamname: string
  timestamp: number
}

export default (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Text type="BodyTiny">{formatTimeForChat(props.timestamp)}</Kb.Text>
    <Kb.ConnectedUsernames
      type="BodySmallSemibold"
      suffixType="BodySmall"
      onUsernameClicked="profile"
      colorFollowing={true}
      underline={true}
      usernames={props.leavers}
      suffix={` left ${props.isBigTeam ? `#${props.channelname}` : props.teamname}.`}
    />
  </Kb.Box2>
)
