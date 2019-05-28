import {Component} from 'react'
import * as Types from '../../constants/types/settings'

export type Props = {
  inviteEmail: string
  inviteMessage: string
  showMessageField: boolean
  pendingInvites: Array<Types.PendingInvite>
  acceptedInvites: Array<Types.AcceptedInvite>
  onSelectUser: (username: string) => void
  onReclaimInvitation: (invitationId: string) => void
  onRefresh: () => void
  onGenerateInvitation: (email: string, message: string) => void
  onClearError: () => void
  onSelectPendingInvite: (invite: Types.PendingInvite) => void
  waitingForResponse: boolean
  error: Error | null
}

export default class Invites extends Component<Props> {}
