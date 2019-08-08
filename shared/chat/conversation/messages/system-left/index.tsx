import * as React from 'react'
import * as Kb from '../../../../common-adapters'

type Props = {
  channelname: string
  isBigTeam: boolean
  leavers: Array<string>
  teamname: string
}

export default (props: Props) => (
  <Kb.ConnectedUsernames
    type="BodySmallSemibold"
    suffixType="BodySmall"
    onUsernameClicked="profile"
    colorFollowing={true}
    underline={true}
    usernames={props.leavers}
    suffix={` left ${props.isBigTeam ? `#${props.channelname}` : props.teamname}.`}
  />
)
