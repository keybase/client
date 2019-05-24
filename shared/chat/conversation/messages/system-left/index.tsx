import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  channelname: string
  isBigTeam: boolean
  teamname: string
}

export default (props: Props) => (
  <Kb.Text type="BodySmall" style={styles.text}>
    left {props.isBigTeam ? `#${props.channelname}` : props.teamname}.
  </Kb.Text>
)

const styles = Styles.styleSheetCreate({
  text: {flexGrow: 1},
})
