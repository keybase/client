import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import type * as T from '@/constants/types'
import {useBotConversationIDKey, useRefreshBotMembershipOnSuccess} from './install'

type Props = {
  botUsername: string
  teamID?: T.Teams.TeamID
  conversationIDKey?: T.Chat.ConversationIDKey
}

const ConfirmBotRemoveImpl = (props: {botUsername: string; teamID?: T.Teams.TeamID}) => {
  const {botUsername, teamID} = props
  const clearModals = C.Router2.clearModals
  const error = C.Waiting.useAnyErrors(C.waitingKeyChatBotRemove)
  const removeBotMember = ConvoState.useChatContext(s => s.dispatch.removeBotMember)
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const onClose = () => {
    clearModals()
  }
  const onRemove = () => {
    removeBotMember(botUsername)
  }
  useRefreshBotMembershipOnSuccess(
    conversationIDKey,
    teamID,
    C.waitingKeyChatBotRemove,
    error,
    true,
    {username: botUsername},
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
    <ConvoState.ChatProvider id={conversationIDKey}>
      <ConfirmBotRemoveImpl botUsername={botUsername} teamID={teamID} />
    </ConvoState.ChatProvider>
  ) : null
}

export default ConfirmBotRemove
