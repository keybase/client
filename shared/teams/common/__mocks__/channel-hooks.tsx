import type * as Types from '../../../constants/types/teams'
import type * as ChatTypes from '../../../constants/types/chat2'
import * as ChatConstants from '../../../constants/chat2'

export const useChannelParticipants = () => ['channelMember1', 'channelMember2', 'thomasjefferson']

export const useAllChannelMetas = (_: Types.TeamID) => {
  const data: Array<[ChatTypes.ConversationIDKey, Partial<ChatTypes.ConversationMeta>]> = [
    ['0', {channelname: 'general'}],
    ['1', {channelname: 'random'}],
    ['2', {channelname: 'hellos'}],
    ['3', {channelname: 'NY_MemorialDay', description: 'zapu is in town'}],
    ['4', {channelname: 'sandwiches', description: 'the worst foods'}],
    ['5', {channelname: 'soups', description: 'the best foods'}],
    ['6', {channelname: 'stir-fry', membershipType: 'notMember'}],
    ['7', {channelname: 'ice-cream'}],
    ['8', {channelname: 'salad'}],
    ['9', {channelname: 'veg'}],
    ['10', {channelname: 'plate-presentation'}],
    ['11', {channelname: 'team-sqawk'}],
    ['12', {channelname: 'team-birbs'}],
    ['13', {channelname: 'team-beasts'}],
    ['14', {channelname: 'team-dogs-of-the-sea-and-other-creatures'}],
  ]
  const channelMetas = new Map(data.map(([a, b]) => [a, {...ChatConstants.makeConversationMeta(), ...b}]))
  return {channelMetas, loadingChannels: false, triggerReload: () => {}}
}

export const useChannelMeta = (
  _: Types.TeamID,
  convID: ChatTypes.ConversationIDKey
): ChatTypes.ConversationMeta => ({
  ...ChatConstants.makeConversationMeta(),
  channelname: 'hellos',
  conversationIDKey: convID,
  description: 'hello hello hello hello hello',
})
