import * as C from '@/constants'
import * as Styles from '@/styles'
import WaitingButton from '@/common-adapters/waiting-button'
import Icon from '@/common-adapters/icon'

// pulled in from common-adapters/profile-card
const Kb = {
  Icon,
  WaitingButton,
}

type Props = {
  small?: boolean
  style?: Styles.StylesCrossPlatform
  username: string
  afterClick?: () => void
}

const ChatButton = ({small, style, username, afterClick}: Props) => {
  const showMain = C.useConfigState(s => s.dispatch.showMain)
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const chat = () => {
    afterClick?.()
    showMain()
    previewConversation({participants: [username], reason: 'tracker'})
  }
  return (
    <Kb.WaitingButton
      key="Chat"
      label="Chat"
      waitingKey={C.Chat.waitingKeyCreating}
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
