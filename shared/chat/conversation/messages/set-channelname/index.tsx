import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  message: Types.MessageSetChannelname
}

export default (props: Props) =>
  // suppress this message for the #general channel, it is redundant.
  props.message.newChannelname === 'general' ? null : (
    <Kb.Text type="BodySmall" style={styles.text} selectable={true}>
      set the channel name to <Kb.Text type="BodySmallItalic">#{props.message.newChannelname}</Kb.Text>
    </Kb.Text>
  )

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    } as const)
)
