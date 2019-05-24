import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'

type Props = {
  message: Types.MessageSetDescription
}

export default (props: Props) => {
  const desc = props.message.newDescription.stringValue()
  return desc ? (
    <Kb.Text type="BodySmall" style={styles.text} selectable={true}>
      set the channel description: <Kb.Text type="BodySmallSemiboldItalic">{desc}</Kb.Text>
    </Kb.Text>
  ) : (
    <Kb.Text type="BodySmall" style={styles.text}>
      cleared the channel description.
    </Kb.Text>
  )
}

const styles = Styles.styleSheetCreate({
  text: {flexGrow: 1},
})
