import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useConversationCenterActions} from '../../center-context'

type Props = {messageID: T.Chat.MessageID}

const Pin = (props: Props) => {
  const styles = useStyles()
  const {messageID} = props
  const {centerOnMessage} = useConversationCenterActions()
  const onReplyClick = () => centerOnMessage(messageID, 'flash')
  return (
    <Kb.Text type="BodySmall" style={styles.text} onClick={onReplyClick}>
      pinned a message to this chat.
    </Kb.Text>
  )
}

export default Pin

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      text: {flexGrow: 1},
    }) as const
)
