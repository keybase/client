import * as ConvoState from '@/stores/convostate'
import {chatDebugEnabled} from '@/constants/chat/debug'
import logger from '@/logger'
import {PerfProfiler} from '@/perf/react-profiler'
import type * as React from 'react'
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
  const type = ConvoState.useChatContext(s => s.messageTypeMap.get(ordinal) ?? 'text')
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
