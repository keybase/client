import {Component} from 'react'
import {SettingsTab} from '../../constants/types/settings'
export type Props = {
  badgeNotifications?: boolean
  badgeNumbers: Map<SettingsTab, number>
  contactsLabel: string
  hasRandomPW: boolean | null
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: SettingsTab) => void
  selectedTab: SettingsTab
}

export default class SettingsNav extends Component<Props> {}
