import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {getChatRpc} from '../chat-rpc'
import {botPopupKey, finishBotMutation, useBotConversationIDKey} from './install'

type Props = {
  botUsername: string
  teamID?: T.Teams.TeamID
  conversationIDKey?: T.Chat.ConversationIDKey
}

const ConfirmBotRemoveImpl = (props: {
  botUsername: string
  conversationIDKey: T.Chat.ConversationIDKey
}) => {
  const {botUsername, conversationIDKey} = props
  const clearModals = C.Router2.clearModals
  const onClose = () => {
    clearModals()
  }
  const onRemove = () => {
    const popupKey = botPopupKey('chatConfirmRemoveBot', botUsername)
    const f = async () => {
      try {
        await getChatRpc().removeBotMember({
          conversationIDKey,
          username: botUsername,
          waitingKey: C.waitingKeyChatBotRemove,
        })
      } catch (error) {
        if (error instanceof RPCError) {
          logger.info('removeBotMember: failed to remove bot member: ' + error.message)
        }
        return
      }
      await finishBotMutation(conversationIDKey, popupKey)
    }
    C.ignorePromise(f())
  }
  return (
    <Kb.ConfirmModal
      confirmText="Uninstall"
      prompt={`Uninstall ${botUsername}?`}
      waitingKey={C.waitingKeyChatBotRemove}
      onConfirm={onRemove}
      onCancel={onClose}
      header={<Kb.Avatar username={botUsername} size={isMobile ? 96 : 64} />}
    />
  )
}

const ConfirmBotRemove = (props: Props) => {
  const {teamID, botUsername} = props
  const conversationIDKey = useBotConversationIDKey(props.conversationIDKey, teamID)
  return conversationIDKey ? (
    <ConfirmBotRemoveImpl botUsername={botUsername} conversationIDKey={conversationIDKey} />
  ) : null
}

export default ConfirmBotRemove
