import {ChannelMembershipState} from '../../constants/types/teams'
import {ConversationIDKey} from '../../constants/types/chat2'

export type RowProps = {
  description: string
  hasAllMembers: boolean
  name: string
  numParticipants: number
  mtimeHuman: string
  selected: boolean
}

export type Props = {
  onBack?: () => void
  canCreateChannels: boolean
  canEditChannels: boolean
  channels: Array<
    RowProps & {
      convID: ConversationIDKey
    }
  >
  onCreate: () => void
  onToggle: (convID: ConversationIDKey) => void
  onEdit: (convID: ConversationIDKey) => void
  onClose?: () => void
  onClickChannel: (channelname: string) => void
  teamname: string
  unsavedSubscriptions: boolean
  onSaveSubscriptions: () => void
  waitingForGet: boolean
  waitingKey: string
  nextChannelState: ChannelMembershipState
}
