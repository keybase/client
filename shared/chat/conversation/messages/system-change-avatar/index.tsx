import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'

type Props = {
  team: string
  user: string
  you: string
}
const SystemChangeAvatar = (props: Props) => {
  console.warn(props)
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" style={styles.text}>
        {props.user === props.you ? 'You ' : ''}changed the team's avatar.
      </Kb.Text>
      <Kb.Avatar teamname={props.team} size={128} />
    </UserNotice>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  text: {
    marginBottom: Styles.globalMargins.tiny,
  },
}))

export default SystemChangeAvatar
