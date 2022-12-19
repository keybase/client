import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import type * as Types from '../../../../constants/types/chat2'

type Props = {
  message: Types.MessageSetDescription
}

const lquote = '\u201C'
const rquote = '\u201D'
const SetDescriptionMessage = (props: Props) => {
  const desc = props.message.newDescription.stringValue()
  return desc ? (
    <Kb.Text type="BodySmall" style={styles.text} selectable={true}>
      changed the channel description to{' '}
      <Kb.Text type="BodySmallItalic">
        {lquote}
        {desc}
        {rquote}
      </Kb.Text>
    </Kb.Text>
  ) : (
    <Kb.Text type="BodySmall" style={styles.text}>
      cleared the channel description.
    </Kb.Text>
  )
}
export default SetDescriptionMessage

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    } as const)
)
