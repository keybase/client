import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'

function LeftContainer() {
  const meta = ConvoState.useChatContext(s => s.meta)
  const {channelname, teamType, teamname} = meta
  const isBigTeam = teamType === 'big'

  return (
    <UserNotice>
      <Kb.Text type="BodySmall">{`left ${isBigTeam ? `#${channelname}` : teamname}.`}</Kb.Text>
    </UserNotice>
  )
}

export default LeftContainer
