import * as C from '../../../../constants'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as T from '../../../../constants/types'
import UserNotice from '../user-notice'

type Props = {
  message: T.Chat.MessageSystemChangeAvatar
}
const SystemChangeAvatar = (props: Props) => {
  const you = C.useCurrentUserState(s => s.username)
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" style={styles.text}>
        {props.message.user === you ? 'You ' : ''}changed the team's avatar.
      </Kb.Text>
      <Kb.Avatar teamname={props.message.team} size={128} />
    </UserNotice>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  text: {
    marginBottom: Styles.globalMargins.tiny,
  },
}))

export default SystemChangeAvatar
