import * as C from '../../../../constants'
import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import type * as Types from '../../../../constants/types/chat2'

type Props = {
  messageID: Types.MessageID
}

const Pin = (props: Props) => {
  const {messageID} = props
  const replyJump = C.useChatContext(s => s.dispatch.replyJump)
  const onReplyClick = () => replyJump(messageID)
  return (
    <Kb.Text type="BodySmall" style={styles.text} onClick={onReplyClick}>
      pinned a message to this chat.
    </Kb.Text>
  )
}

export default Pin

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    }) as const
)
