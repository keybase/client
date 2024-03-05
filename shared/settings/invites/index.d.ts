import type * as React from 'react'
import type {PendingInvite, AcceptedInvite} from '@/constants/settings-invites'

export type Props = {
  acceptedInvites: ReadonlyArray<AcceptedInvite>
  error: string
  inviteEmail: string
  inviteMessage: string
  onClearError: () => void
  onGenerateInvitation: (email: string, message: string) => void
  onReclaimInvitation: (invitationId: string) => void
  onRefresh: () => void
  onSelectPendingInvite: (invite: PendingInvite) => void
  onSelectUser: (username: string) => void
  pendingInvites: ReadonlyArray<PendingInvite>
  showMessageField: boolean
  waitingForResponse: boolean
}

declare const Invites: (p: Props) => React.ReactNode
export default Invites
