import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../user-notice'

type Props = {
  message: Types.MessageSystemChangeAvatar
}
const SystemChangeAvatar = (props: Props) => {
  const you = Container.useSelector(state => state.config.username)
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
