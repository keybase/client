import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {useConversationThreadSelector} from '../../thread-context'
import {makeMessageWrapper} from '../wrapper/wrapper'

function SystemLeft() {
  const meta = useConversationThreadSelector(s => s.meta)
  const {channelname, teamType, teamname} = meta
  const isBigTeam = teamType === 'big'

  return (
    <UserNotice>
      <Kb.Text type="BodySmall">{`left ${isBigTeam ? `#${channelname}` : teamname}.`}</Kb.Text>
    </UserNotice>
  )
}

export default makeMessageWrapper('systemLeft', () => <SystemLeft />)
