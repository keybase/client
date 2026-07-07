import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {useThreadMeta} from '../../thread-context'
import {makeMessageWrapper} from '../wrapper/wrapper'

function SystemLeft() {
  const {channelname, teamType, teamname} = useThreadMeta(
    C.useShallow(m => ({channelname: m.channelname, teamType: m.teamType, teamname: m.teamname}))
  )
  const isBigTeam = teamType === 'big'

  return (
    <UserNotice>
      <Kb.Text type="BodySmall">{`left ${isBigTeam ? `#${channelname}` : teamname}.`}</Kb.Text>
    </UserNotice>
  )
}

export default makeMessageWrapper('systemLeft', () => <SystemLeft />)
