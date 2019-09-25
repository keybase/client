import {Component} from 'react'
export type Props = {
  badgeNumber?: number
  channelName?: string
  contactNames: {[participant: string]: string}
  muted: boolean
  onBack: () => void
  onOpenFolder?: () => void
  onShowProfile: (user: string) => void
  onToggleInfoPanel: () => void
  onToggleThreadSearch: () => void
  infoPanelOpen: boolean
  teamName?: string
  participants: Array<string>
  pendingWaiting: boolean
  smallTeam: boolean
  unMuteConversation: () => void
}
export class ChannelHeader extends Component<Props> {}
export class UsernameHeader extends Component<Props> {}
export class PhoneOrEmailHeader extends Component<Props> {}
