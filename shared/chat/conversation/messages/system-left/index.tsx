import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'

type Props = {
  channelname: string
  isBigTeam: boolean
  leavers: Array<string>
  teamname: string
  timestamp: number
}

export default (props: Props) => (
  <UserNotice>
    <Kb.Text type="BodySmall">{` left ${
      props.isBigTeam ? `#${props.channelname}` : props.teamname
    }.`}</Kb.Text>
  </UserNotice>
)
