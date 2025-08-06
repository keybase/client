import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

type Props = {
  message: T.Chat.MessageSetDescription
}

const lquote = '\u201C'
const rquote = '\u201D'
const SetDescriptionMessage = (props: Props) => {
  const desc = props.message.newDescription.stringValue()
  return desc ? (
    <Kb.Text type="BodySmall" style={styles.text}>
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    }) as const
)
