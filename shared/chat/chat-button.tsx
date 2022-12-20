import * as ChatConstants from '../constants/chat2'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ConfigGen from '../actions/config-gen'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'

type Props = {
  small?: boolean
  style?: Styles.StylesCrossPlatform
  username: string
  afterClick?: () => void
}

const ChatButton = ({small, style, username, afterClick}: Props) => {
  const dispatch = Container.useDispatch()
  const chat = () => {
    afterClick?.()
    dispatch(ConfigGen.createShowMain())
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'tracker'}))
  }
  return (
    <Kb.WaitingButton
      key="Chat"
      label="Chat"
      waitingKey={ChatConstants.waitingKeyCreating}
      onClick={chat}
      small={small}
      style={style}
    >
      <Kb.Icon type="iconfont-chat" color={Styles.globalColors.whiteOrWhite} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )
}

export default ChatButton

const styles = Styles.styleSheetCreate(() => ({
  chatIcon: {
    marginRight: Styles.globalMargins.tiny,
  },
}))
