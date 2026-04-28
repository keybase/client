import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {useConversationThreadMeta} from '../../thread-context'

function LeftContainer() {
  const meta = useConversationThreadMeta()
  const {channelname, teamType, teamname} = meta
  const isBigTeam = teamType === 'big'

  return (
    <UserNotice>
      <Kb.Text type="BodySmall">{`left ${isBigTeam ? `#${channelname}` : teamname}.`}</Kb.Text>
    </UserNotice>
  )
}

export default LeftContainer
