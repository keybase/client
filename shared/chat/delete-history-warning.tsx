import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useConversationMeta} from './conversation/data-hooks'
import logger from '@/logger'
import {getChatRpc} from './conversation/chat-rpc'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
}

const DeleteHistoryWarning = (props: Props) => {
  const styles = useStyles()
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const onCancel = C.Router2.navigateUp
  const clearModals = C.Router2.clearModals
  const {tlfname} = useConversationMeta(conversationIDKey)
  const onDeleteHistory = () => {
    clearModals()
    const f = async () => {
      if (!tlfname) {
        logger.warn('Deleting message history for non-existent TLF:')
        return
      }
      await getChatRpc().deleteHistory(conversationIDKey, tlfname)
    }
    C.ignorePromise(f())
  }

  return (
    <Kb.ModalScreen
      centered={true}
      footer={
        <Kb.ConfirmButtons
          split={true}
          onCancel={onCancel}
          onConfirm={onDeleteHistory}
          confirmLabel="Yes, clear for everyone"
          confirmType="Danger"
        />
      }
    >
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="small" style={styles.container}>
        <Kb.ImageIcon type={isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
        <Kb.Text center={true} type="Body">
          You are about to delete all the messages in this conversation. For everyone.
        </Kb.Text>
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  container: {paddingTop: Kb.Styles.globalMargins.small},
}))

export default DeleteHistoryWarning
