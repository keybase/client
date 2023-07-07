import * as React from 'react'
import type {PendingInvite, AcceptedInvite} from '../../constants/settings-invites'

export type Props = {
  acceptedInvites: Array<AcceptedInvite>
  error: string
  inviteEmail: string
  inviteMessage: string
  onClearError: () => void
  onGenerateInvitation: (email: string, message: string) => void
  onReclaimInvitation: (invitationId: string) => void
  onRefresh: () => void
  onSelectPendingInvite: (invite: PendingInvite) => void
  onSelectUser: (username: string) => void
  pendingInvites: Array<PendingInvite>
  showMessageField: boolean
  waitingForResponse: boolean
}

export default class Invites extends React.Component<Props> {}
