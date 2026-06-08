import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useConversationCenter} from '../../center-context'

type Props = {messageID: T.Chat.MessageID}

const Pin = (props: Props) => {
  const {messageID} = props
  const {centerOnMessage} = useConversationCenter()
  const onReplyClick = () => centerOnMessage(messageID, 'flash')
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
