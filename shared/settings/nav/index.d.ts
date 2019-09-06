import {Component} from 'react'
import {SettingsTab} from '../../constants/settings'
import {Tab} from '../../constants/tabs'
export type Props = {
  badgeNotifications?: boolean
  badgeNumbers: Map<Tab, number>
  contactsLabel: string
  hasRandomPW: boolean | null
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: SettingsTab) => void
  selectedTab: SettingsTab
}

export default class SettingsNav extends Component<Props> {}
