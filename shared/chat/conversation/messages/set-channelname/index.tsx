import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  message: Types.MessageSetChannelname
}

export default (props: Props) => (
  <Kb.Text type="BodySmall" style={styles.text} selectable={true}>
    set the channel name to #{props.message.newChannelname}
  </Kb.Text>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    } as const)
)
