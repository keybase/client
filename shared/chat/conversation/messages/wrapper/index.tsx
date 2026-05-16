import {chatDebugEnabled} from '@/constants/chat/debug'
import logger from '@/logger'
import {PerfProfiler} from '@/perf/react-profiler'
import type * as React from 'react'
import {useConversationThreadSelector} from '@/chat/conversation/thread-context'
import Text from '@/chat/conversation/messages/text/wrapper'
import {
  WrapperAttachmentAudio,
  WrapperAttachmentFile,
  WrapperAttachmentImage,
  WrapperAttachmentVideo,
} from '@/chat/conversation/messages/attachment/wrapper'
import JourneyCard from '@/chat/conversation/messages/cards/team-journey/wrapper'
import Placeholder from '@/chat/conversation/messages/placeholder/wrapper'
import Payment from '@/chat/conversation/messages/account-payment/wrapper'
import SystemInviteAccepted from '@/chat/conversation/messages/system-invite-accepted/wrapper'
import SystemSBSResolved from '@/chat/conversation/messages/system-sbs-resolve/wrapper'
import SystemSimpleToComplex from '@/chat/conversation/messages/system-simple-to-complex/wrapper'
import SystemGitPush from '@/chat/conversation/messages/system-git-push/wrapper'
import SystemCreateTeam from '@/chat/conversation/messages/system-create-team/wrapper'
import SystemAddedToTeam from '@/chat/conversation/messages/system-added-to-team/wrapper'
import SystemChangeRetention from '@/chat/conversation/messages/system-change-retention/wrapper'
import SystemUsersAddedToConv from '@/chat/conversation/messages/system-users-added-to-conv/wrapper'
import SystemJoined from '@/chat/conversation/messages/system-joined/wrapper'
import SystemText from '@/chat/conversation/messages/system-text/wrapper'
import SystemLeft from '@/chat/conversation/messages/system-left/wrapper'
import SystemChangeAvatar from '@/chat/conversation/messages/system-change-avatar/wrapper'
import SystemNewChannel from '@/chat/conversation/messages/system-new-channel/wrapper'
import SetDescription from '@/chat/conversation/messages/set-description/wrapper'
import Pin from '@/chat/conversation/messages/pin/wrapper'
import SetChannelname from '@/chat/conversation/messages/set-channelname/wrapper'
import {type Props} from '@/chat/conversation/messages/wrapper/wrapper'
import type * as T from '@/constants/types'

const renderMessageRow = (type: T.Chat.RenderMessageType, p: Props): React.ReactNode => {
  switch (type) {
    case 'attachment:audio':
      return <WrapperAttachmentAudio {...p} />
    case 'attachment:file':
      return <WrapperAttachmentFile {...p} />
    case 'attachment:image':
      return <WrapperAttachmentImage {...p} />
    case 'attachment:video':
      return <WrapperAttachmentVideo {...p} />
    case 'journeycard':
      return <JourneyCard {...p} />
    case 'pin':
      return <Pin {...p} />
    case 'placeholder':
      return <Placeholder {...p} />
    case 'requestPayment':
    case 'sendPayment':
      return <Payment {...p} />
    case 'setChannelname':
      return <SetChannelname {...p} />
    case 'setDescription':
      return <SetDescription {...p} />
    case 'systemAddedToTeam':
      return <SystemAddedToTeam {...p} />
    case 'systemChangeAvatar':
      return <SystemChangeAvatar {...p} />
    case 'systemChangeRetention':
      return <SystemChangeRetention {...p} />
    case 'systemCreateTeam':
      return <SystemCreateTeam {...p} />
    case 'systemGitPush':
      return <SystemGitPush {...p} />
    case 'systemInviteAccepted':
      return <SystemInviteAccepted {...p} />
    case 'systemJoined':
      return <SystemJoined {...p} />
    case 'systemLeft':
      return <SystemLeft {...p} />
    case 'systemNewChannel':
      return <SystemNewChannel {...p} />
    case 'systemSBSResolved':
      return <SystemSBSResolved {...p} />
    case 'systemSimpleToComplex':
      return <SystemSimpleToComplex {...p} />
    case 'systemText':
      return <SystemText {...p} />
    case 'systemUsersAddedToConversation':
      return <SystemUsersAddedToConv {...p} />
    case 'text':
      return <Text {...p} />
    case 'deleted':
      return null
    default:
      return null
  }
}

export const MessageRow = function MessageRow(p: Props) {
  const {ordinal} = p
  const type = useConversationThreadSelector(s => s.messageTypeMap.get(ordinal) ?? 'text')
  const content = renderMessageRow(type, p)
  if (!content) {
    if (type === 'deleted') {
      return null
    }
    if (chatDebugEnabled) {
      logger.error('[CHATDEBUG] no rendertype', {ordinal, type})
    }
    return null
  }
  return <PerfProfiler id={`Msg-${type}`}>{content}</PerfProfiler>
}
