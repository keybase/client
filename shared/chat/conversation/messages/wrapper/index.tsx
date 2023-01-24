import Text from '../text/wrapper'
import {
  WrapperAttachmentAudio,
  WrapperAttachmentFile,
  WrapperAttachmentImage,
  WrapperAttachmentVideo,
} from '../attachment/wrapper'
import JourneyCard from '../cards/team-journey/wrapper'
import Placeholder from '../placeholder/wrapper'
import Payment from '../account-payment/wrapper'
import SystemInviteAccepted from '../system-invite-accepted/wrapper'
import SystemSBSResolved from '../system-sbs-resolve/wrapper'
import SystemSimpleToComplex from '../system-simple-to-complex/wrapper'
import SystemGitPush from '../system-git-push/wrapper'
import SystemCreateTeam from '../system-create-team/wrapper'
import SystemAddedToTeam from '../system-added-to-team/wrapper'
import SystemChangeRetention from '../system-change-retention/wrapper'
import SystemUsersAddedToConv from '../system-users-added-to-conv/wrapper'
import SystemJoined from '../system-joined/wrapper'
import SystemText from '../system-text/wrapper'
import SystemLeft from '../system-left/wrapper'
import SystemChangeAvatar from '../system-change-avatar/wrapper'
import SystemNewChannel from '../system-new-channel/wrapper'
import SetDescription from '../set-description/wrapper'
import Pin from '../pin/wrapper'
import SetChannelname from '../set-channelname/wrapper'
import {type Props} from './wrapper'
import type * as Types from '../../../../constants/types/chat2'

const typeMap = {
  'attachment:audio': WrapperAttachmentAudio,
  'attachment:file': WrapperAttachmentFile,
  'attachment:image': WrapperAttachmentImage,
  'attachment:video': WrapperAttachmentVideo,
  journeycard: JourneyCard,
  pin: Pin,
  placeholder: Placeholder,
  requestPayment: Payment,
  sendPayment: Payment,
  setChannelname: SetChannelname,
  setDescription: SetDescription,
  systemAddedToTeam: SystemAddedToTeam,
  systemChangeAvatar: SystemChangeAvatar,
  systemChangeRetention: SystemChangeRetention,
  systemCreateTeam: SystemCreateTeam,
  systemGitPush: SystemGitPush,
  systemInviteAccepted: SystemInviteAccepted,
  systemJoined: SystemJoined,
  systemLeft: SystemLeft,
  systemNewChannel: SystemNewChannel,
  systemSBSResolved: SystemSBSResolved,
  systemSimpleToComplex: SystemSimpleToComplex,
  systemText: SystemText,
  systemUsersAddedToConversation: SystemUsersAddedToConv,
  text: Text,
} satisfies Partial<Record<Types.RenderMessageType, React.NamedExoticComponent<Props>>> as Record<
  Types.RenderMessageType,
  React.NamedExoticComponent<Props> | undefined
>

export const getMessageRender = (type: Types.RenderMessageType) => {
  return type === 'deleted' ? undefined : typeMap[type]
}
