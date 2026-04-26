import * as C from '@/constants'
import * as Styles from '@/styles'
import WaitingButton from '@/common-adapters/waiting-button'
import Icon from '@/common-adapters/icon'
import {showMain} from '@/util/storeless-actions'

// pulled in from common-adapters/profile-card
const Kb = {
  Icon,
  WaitingButton,
}

type Props = {
  small?: boolean | undefined
  style?: Styles.StylesCrossPlatform
  username: string
  afterClick?: (() => void) | undefined
}

const ChatButton = ({small, style, username, afterClick}: Props) => {
  const previewConversation = C.Router2.previewConversation
  const chat = () => {
    afterClick?.()
    showMain()
    previewConversation({participants: [username], reason: 'tracker'})
  }
  return (
    <Kb.WaitingButton
      key="Chat"
      label="Chat"
      waitingKey={C.waitingKeyChatCreating}
      onClick={chat}
      small={small ?? false}
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
