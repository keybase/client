import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  channelname: string
  isBigTeam: boolean
  leavers: Array<string>
  teamname: string
}

export default (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
    <Kb.ConnectedUsernames
      inline={true}
      type="BodySmallSemibold"
      onUsernameClicked="profile"
      colorFollowing={true}
      underline={true}
      usernames={props.leavers}
    />
    <Kb.Text type="BodySmall" style={styles.text}>
      left {props.isBigTeam ? `#${props.channelname}` : props.teamname}.
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  text: {flexGrow: 1},
})
