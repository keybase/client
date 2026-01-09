import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import UserNotice from '../user-notice'
import {useCurrentUserState} from '@/stores/current-user'

type Props = {
  message: T.Chat.MessageSystemChangeAvatar
}
const SystemChangeAvatar = (props: Props) => {
  const you = useCurrentUserState(s => s.username)
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" style={styles.text}>
        {props.message.user === you ? "You changed the team's avatar." : "The team's avatar was changed."}
      </Kb.Text>
      <Kb.Avatar teamname={props.message.team} size={128} />
    </UserNotice>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  text: {
    marginBottom: Kb.Styles.globalMargins.tiny,
  },
}))

export default SystemChangeAvatar
