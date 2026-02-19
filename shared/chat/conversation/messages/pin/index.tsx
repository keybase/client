import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

type Props = {messageID: T.Chat.MessageID}

const Pin = (props: Props) => {
  const {messageID} = props
  const replyJump = Chat.useChatContext(s => s.dispatch.replyJump)
  const onReplyClick = () => replyJump(messageID)
  return (
    <Kb.Text type="BodySmall" style={styles.text} onClick={onReplyClick}>
      pinned a message to this chat.
    </Kb.Text>
  )
}

export default Pin

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    }) as const
)
