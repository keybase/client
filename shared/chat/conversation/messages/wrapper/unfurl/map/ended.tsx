import * as React from 'react'
import * as Styles from '../../../../../../styles'
import * as Kb from '../../../../../../common-adapters'
import {formatTimeForChat} from '../../../../../../util/timestamp'

type Props = {
  endTime?: number
}

const UnfurlSharingEnded = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Text type="BodySemibold">Location sharing ended</Kb.Text>
    {props.endTime && <Kb.Text type="BodyTiny">Last updated {formatTimeForChat(props.endTime)}</Kb.Text>}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: Styles.globalMargins.xtiny,
  },
}))

export default UnfurlSharingEnded
