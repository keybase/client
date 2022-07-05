import {Component} from 'react'
import * as Types from '../../constants/types/settings'

export type Props = {
  acceptedInvites: Array<Types.AcceptedInvite>
  error?: Error
  inviteEmail: string
  inviteMessage: string
  onClearError: () => void
  onGenerateInvitation: (email: string, message: string) => void
  onReclaimInvitation: (invitationId: string) => void
  onRefresh: () => void
  onSelectPendingInvite: (invite: Types.PendingInvite) => void
  onSelectUser: (username: string) => void
  pendingInvites: Array<Types.PendingInvite>
  showMessageField: boolean
  waitingForResponse: boolean
}

export default class Invites extends Component<Props> {}
