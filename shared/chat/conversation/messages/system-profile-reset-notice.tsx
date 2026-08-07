import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from './user-notice'
import {useThreadMeta} from '../thread-context'

const SystemProfileResetNotice = () => {
  const styles = useStyles()
  const meta = useThreadMeta(
    C.useShallow(m => ({supersedes: m.supersedes, wasFinalizedBy: m.wasFinalizedBy}))
  )
  const prevConversationIDKey = meta.supersedes
  const username = meta.wasFinalizedBy || ''
  const _onOpenOlderConversation = (conversationIDKey: T.Chat.ConversationIDKey) => {
    C.Router2.navigateToThread(conversationIDKey, 'jumpToReset')
  }
  const onOpenOlderConversation = () => {
    if (prevConversationIDKey) {
      _onOpenOlderConversation(prevConversationIDKey)
    }
  }
  return (
    <UserNotice>
      <Kb.Text type="BodySmallSemibold" negative={true} style={styles.text}>
        {username} reset their profile
      </Kb.Text>
      <Kb.Text
        type="BodySmallPrimaryLink"
        negative={true}
        style={styles.text}
        onClick={onOpenOlderConversation}
      >
        View older conversation
      </Kb.Text>
    </UserNotice>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  text: {color: theme.black_50},
}))

export default SystemProfileResetNotice
