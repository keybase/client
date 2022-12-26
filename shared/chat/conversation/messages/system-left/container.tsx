import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'

type OwnProps = {
  message: Types.MessageSystemLeft
}

const LeftContainer = React.memo(function LeftContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey} = message
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {channelname, teamType, teamname} = meta
  const isBigTeam = teamType === 'big'

  return (
    <UserNotice>
      <Kb.Text type="BodySmall">{`left ${isBigTeam ? `#${channelname}` : teamname}.`}</Kb.Text>
    </UserNotice>
  )
})

export default LeftContainer
