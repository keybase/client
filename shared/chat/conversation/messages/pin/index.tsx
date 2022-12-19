import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import type * as Types from '../../../../constants/types/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  messageID: Types.MessageID
}

const Pin = (props: Props) => {
  const {conversationIDKey, messageID} = props
  // dispatch
  const dispatch = Container.useDispatch()
  const onReplyClick = () =>
    dispatch(
      Chat2Gen.createReplyJump({
        conversationIDKey,
        messageID,
      })
    )

  // render
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
    } as const)
)
