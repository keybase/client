import type * as T from '@/constants/types'
import {useLoadedTeam} from '../team/use-loaded-team'
import {useLoadedTeamChannels} from './use-loaded-team-channels'

// Filter bots out using team role info, isolate to only when related state changes
export const useChannelParticipants = (
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey,
  // Team channel participants are empty in the getTLFConversations result (the Go
  // localizer leaves Info.Participants empty for team convs); they arrive async via
  // ChatParticipantsInfo in useInboxMetadataState. Callers that can safely import
  // chat/inbox state (leaf screens, not this require-cycle module) pass it here.
  inboxParticipants?: T.Immutable<T.Chat.ParticipantInfo>
) => {
  const {channelParticipants} = useLoadedTeamChannels(teamID)
  const participants = inboxParticipants?.all ?? channelParticipants.get(conversationIDKey)?.all ?? []
  const {
    teamDetails: {members: teamMembers},
  } = useLoadedTeam(teamID)
  return participants.filter(username => {
    const maybeMember = teamMembers.get(username)
    return maybeMember && maybeMember.type !== 'bot' && maybeMember.type !== 'restrictedbot'
  })
}

// The channel metas come from the same getTLFConversations result as the channel
// list, so this is a view onto that one cache rather than a second loader.
export const useAllChannelMetas = (
  teamID: T.Teams.TeamID,
  dontCallRPC?: boolean
): {
  channelMetas: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ConversationMeta>
  channelParticipants: ReadonlyMap<T.Chat.ConversationIDKey, T.Chat.ParticipantInfo>
  loadingChannels: boolean
  reloadChannels: () => Promise<void>
} => {
  const {
    teamMeta: {teamname},
  } = useLoadedTeam(teamID)
  const {channelMetas, channelParticipants, loading, reload} = useLoadedTeamChannels(
    teamID,
    undefined,
    !dontCallRPC
  )
  return {
    channelMetas,
    channelParticipants,
    loadingChannels: (!dontCallRPC && !teamname) || loading,
    reloadChannels: reload,
  }
}
