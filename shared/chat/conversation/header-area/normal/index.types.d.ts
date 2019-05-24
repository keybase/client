export type Props = {
  badgeNumber?: number
  channelName: string | null
  muted: boolean
  onBack: () => void
  onOpenFolder: null | (() => void)
  onShowProfile: (user: string) => void
  onToggleInfoPanel: () => void
  onToggleThreadSearch: () => void
  infoPanelOpen: boolean
  teamName: string | null
  participants: Array<string>
  pendingWaiting: boolean
  smallTeam: boolean
  unMuteConversation: () => void
}
