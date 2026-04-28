import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {useBotConversationIDKey, useRefreshBotMembershipOnSuccess} from './install'
import {ConversationThreadProvider, useConversationThreadID} from '../thread-context'

type Props = {
  botUsername: string
  teamID?: T.Teams.TeamID
  conversationIDKey?: T.Chat.ConversationIDKey
}

const ConfirmBotRemoveImpl = (props: {botUsername: string}) => {
  const {botUsername} = props
  const clearModals = C.Router2.clearModals
  const error = C.Waiting.useAnyErrors(C.waitingKeyChatBotRemove)
  const conversationIDKey = useConversationThreadID()
  const onClose = () => {
    clearModals()
  }
  const onRemove = () => {
    const f = async () => {
      try {
        await T.RPCChat.localRemoveBotMemberRpcPromise(
          {convID: T.Chat.keyToConversationID(conversationIDKey), username: botUsername},
          C.waitingKeyChatBotRemove
        )
      } catch (error) {
        if (error instanceof RPCError) {
          logger.info('removeBotMember: failed to remove bot member: ' + error.message)
        }
      }
    }
    C.ignorePromise(f())
  }
  useRefreshBotMembershipOnSuccess(
    conversationIDKey,
    C.waitingKeyChatBotRemove,
    error,
    true,
    clearModals
  )
  return (
    <Kb.ConfirmModal
      prompt={`Are you sure you want to uninstall ${botUsername}?`}
      waitingKey={C.waitingKeyChatBotRemove}
      onConfirm={onRemove}
      onCancel={onClose}
      description=""
      header={<Kb.Avatar username={botUsername} size={96} />}
    />
  )
}

const ConfirmBotRemove = (props: Props) => {
  const {teamID, botUsername} = props
  const conversationIDKey = useBotConversationIDKey(props.conversationIDKey, teamID)
  return conversationIDKey ? (
    <ConversationThreadProvider id={conversationIDKey}>
      <ConfirmBotRemoveImpl botUsername={botUsername} />
    </ConversationThreadProvider>
  ) : null
}

export default ConfirmBotRemove
