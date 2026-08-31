import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'

// The service recomputes a team channel's participant list only on demand
// (CachingParticipantSource): no membership change pushes ChatParticipantsInfo by itself,
// and an unbox of an already-trusted conv is dropped client-side. So every action that
// changes who is in a conversation has to ask for the recompute that notifies the store,
// or every open members list keeps rendering the pre-change participants.
export const refreshConversationParticipants = async (
  conversationIDKeys: ReadonlyArray<T.Chat.ConversationIDKey>
) => {
  const ids = [...new Set(conversationIDKeys)].filter(id => T.Chat.isValidConversationIDKey(id))
  await Promise.all(
    ids.map(async id => {
      try {
        await T.RPCChat.localRefreshParticipantsRpcPromise({convID: T.Chat.keyToConversationID(id)})
      } catch {
        // the mutation itself already landed; a stale list self-heals on the next refresh
        logger.info(`refreshConversationParticipants: failed for ${id}`)
      }
    })
  )
}

// Membership can also change from outside this client (someone else adds you, an admin
// kicks a member, a reset user is let back in). teamChangedByID fires for every incoming
// message in the team, so gate on membershipChanged - otherwise an open members list
// issues a participant refresh per message.
export const useRefreshParticipantsOnTeamMembershipChange = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey,
  enabled = true
) => {
  useEngineActionListener(
    'keybase.1.NotifyTeam.teamChangedByID',
    action => {
      const {changes, teamID: changedTeamID} = action.payload.params
      if (changedTeamID === teamID && changes.membershipChanged) {
        void refreshConversationParticipants([conversationIDKey])
      }
    },
    enabled && !!teamID && teamID !== T.Teams.noTeamID
  )
}
